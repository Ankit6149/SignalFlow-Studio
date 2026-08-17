import {
  assertPort,
  createSystemClock,
  createSystemIdService,
} from "../domain/ports.mjs";
import { stableStringify } from "../domain/contracts.mjs";
import { normalizeContentOpportunity } from "../domain/contentOpportunities.mjs";
import { normalizeContentSignal } from "../domain/contentSignals.mjs";
import {
  approveNarrativeStrategy,
  createNarrativeStrategy,
  createPlannedPlatformVariant,
  createPrimaryContentPiece,
  normalizeContentPiece,
  normalizeNarrativeStrategy,
  normalizePlatformVariant,
  reviseNarrativeStrategy,
  STRATEGY_STATUSES,
} from "../domain/contentPlanning.mjs";
import {
  createInferenceTask,
  INFERENCE_TASK_TYPES,
} from "../inference/inferenceTasks.mjs";

function required(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new TypeError(`${field} is required.`);
  return normalized;
}

function selectedAngle(opportunity, decision = null) {
  if (decision?.angleId) {
    const angle = opportunity.candidateAngles.find((item) => item.angleId === decision.angleId);
    if (!angle) throw new Error(`Autopilot opportunity angle ${decision.angleId} no longer exists.`);
    return {
      ...angle,
      selectionOrigin: "autopilot_policy",
      selectionPolicyVersion: decision.policyVersion || null,
      selectionReason: decision.reason || null,
    };
  }
  if (!opportunity.selectedAngleId) throw new Error("Choose a narrative direction before building a campaign plan.");
  if (opportunity.selectedAngleId === "custom") {
    if (!opportunity.customAngle) throw new Error("The custom narrative direction is missing.");
    return {
      angleId: "custom",
      title: opportunity.customAngle.title || "Something else",
      summary: opportunity.customAngle.summary,
      approach: opportunity.customAngle.approach || opportunity.customAngle.summary,
      selectionOrigin: "owner",
      selectionPolicyVersion: null,
      selectionReason: null,
    };
  }
  const angle = opportunity.candidateAngles.find((item) => item.angleId === opportunity.selectedAngleId);
  if (!angle) throw new Error(`Selected opportunity angle ${opportunity.selectedAngleId} no longer exists.`);
  return {
    ...angle,
    selectionOrigin: "owner",
    selectionPolicyVersion: null,
    selectionReason: null,
  };
}

function strategyFingerprint(opportunity, angle, identitySnapshot) {
  return stableStringify({
    opportunityId: opportunity.opportunityId,
    opportunityFingerprint: opportunity.inputFingerprint,
    selectedAngle: {
      angleId: angle.angleId,
      title: angle.title,
      summary: angle.summary,
      approach: angle.approach,
      selectionOrigin: angle.selectionOrigin || "owner",
      selectionPolicyVersion: angle.selectionPolicyVersion || null,
    },
    identityProfileRefs: identitySnapshot.profileRefs || {},
    projectId: opportunity.projectId || null,
  });
}

function minimizeOpportunity(opportunity, angle) {
  return {
    opportunityId: opportunity.opportunityId,
    projectId: opportunity.projectId,
    title: opportunity.title,
    summary: opportunity.summary,
    whyNow: opportunity.whyNow,
    evidenceReadiness: opportunity.evidenceReadiness,
    narrativeFit: opportunity.narrativeFit,
    repetitionRisk: opportunity.repetitionRisk,
    selectedAngle: angle,
    candidateDestinations: opportunity.candidateDestinations,
    recommendedMediaTypes: opportunity.recommendedMediaTypes,
    freshnessState: opportunity.freshnessState,
  };
}

export function createContentPlanningApplication({
  contentPlanningRepository,
  contentOpportunityRepository,
  contentSignalRepository,
  identityApplication,
  inferenceAdapter,
  workspaceId = "local-personal",
  clock = createSystemClock(),
  idService = createSystemIdService("signalflow"),
} = {}) {
  const plans = assertPort("contentPlanningRepository", contentPlanningRepository);
  const opportunities = assertPort("contentOpportunityRepository", contentOpportunityRepository);
  const signals = assertPort("contentSignalRepository", contentSignalRepository);
  const inference = assertPort("inferenceAdapter", inferenceAdapter);
  const appClock = assertPort("clock", clock);
  const appIds = assertPort("idService", idService);
  const ownerWorkspaceId = required(workspaceId, "workspaceId");
  if (!identityApplication || typeof identityApplication.getMinimalProfile !== "function" || typeof identityApplication.createIdentityContextSnapshot !== "function") {
    throw new TypeError("Content planning requires the Identity application service.");
  }

  function assertOwned(record) {
    if (record.workspaceId !== ownerWorkspaceId) throw new Error(`${record.kind} belongs to another workspace.`);
    return record;
  }

  async function requireOpportunity(opportunityId) {
    const stored = await opportunities.get(required(opportunityId, "opportunityId"));
    if (!stored) throw new Error(`ContentOpportunity ${opportunityId} does not exist.`);
    return assertOwned(normalizeContentOpportunity(stored));
  }

  async function requireStrategy(strategyId) {
    const stored = await plans.get(required(strategyId, "strategyId"));
    if (!stored || stored.kind !== "NarrativeStrategy") throw new Error(`NarrativeStrategy ${strategyId} does not exist.`);
    return assertOwned(normalizeNarrativeStrategy(stored));
  }

  async function requireSourceSignal(opportunity) {
    const signalId = opportunity.signalIds?.[0];
    if (!signalId) throw new Error("This opportunity has no source Signal.");
    const stored = await signals.get(signalId);
    if (!stored) throw new Error(`Source ContentSignal ${signalId} no longer exists.`);
    return assertOwned(normalizeContentSignal(stored));
  }

  async function listRecordsForOpportunity(opportunityId) {
    const all = await plans.list();
    return all.filter((record) => record.workspaceId === ownerWorkspaceId && record.opportunityId === opportunityId);
  }

  async function currentStrategyForOpportunity(opportunityId) {
    const records = await listRecordsForOpportunity(opportunityId);
    return records
      .filter((record) => record.kind === "NarrativeStrategy" && record.status !== STRATEGY_STATUSES.SUPERSEDED)
      .map(normalizeNarrativeStrategy)
      .sort((a, b) => b.strategyRevision - a.strategyRevision || b.updatedAt.localeCompare(a.updatedAt))[0] || null;
  }

  async function buildStrategy(opportunityId, { refresh = false, angleDecision = null } = {}) {
    const opportunity = await requireOpportunity(opportunityId);
    if (opportunity.recommendation !== "post") throw new Error("SignalFlow is not currently recommending content from this opportunity.");
    const angle = selectedAngle(opportunity, angleDecision);
    const identity = await identityApplication.getMinimalProfile();
    if (!identity?.identity || !identity?.voice || !identity?.boundary) {
      const error = new Error("Set up your explicit Voice profile before SignalFlow builds an authentic campaign plan.");
      error.code = "voice_profile_required";
      throw error;
    }
    const sourceSignal = await requireSourceSignal(opportunity);
    const snapshot = await identityApplication.createIdentityContextSnapshot({
      platform: null,
      projectId: opportunity.projectId || null,
      campaignInstructions: [],
    });
    const fingerprint = strategyFingerprint(opportunity, angle, snapshot);
    const existing = await currentStrategyForOpportunity(opportunity.opportunityId);
    if (!refresh && existing?.inputFingerprint === fingerprint) return existing;

    const now = appClock.now();
    const task = createInferenceTask({
      taskId: appIds.create("task"),
      workspaceId: ownerWorkspaceId,
      taskType: INFERENCE_TASK_TYPES.NARRATIVE_STRATEGY,
      dataClassification: sourceSignal.privacyClassification,
      inputRefs: [opportunity.opportunityId, sourceSignal.signalId, snapshot.identityContextSnapshotId],
      requirements: ["structured_output", "editorial_reasoning", "identity_context"],
      createdAt: now,
    });
    const result = await inference.execute({
      task,
      input: {
        opportunity: minimizeOpportunity(opportunity, angle),
        identityContext: snapshot,
        dataClassification: sourceSignal.privacyClassification,
      },
    });
    const strategy = createNarrativeStrategy({
      narrativeStrategyId: appIds.create("strategy"),
      workspaceId: ownerWorkspaceId,
      opportunityId: opportunity.opportunityId,
      projectId: opportunity.projectId,
      inputFingerprint: fingerprint,
      selectedAngle: angle,
      identityContextSnapshotId: snapshot.identityContextSnapshotId,
      proposal: result.output,
      taskId: task.taskId,
      createdAt: now,
    });
    const persisted = await plans.upsert(strategy);
    if (existing && existing.narrativeStrategyId !== persisted.narrativeStrategyId) {
      await plans.upsert(normalizeNarrativeStrategy({ ...existing, status: STRATEGY_STATUSES.SUPERSEDED, updatedAt: now }));
    }
    return persisted;
  }

  async function reviseStrategy(strategyId, patch) {
    const strategy = await requireStrategy(strategyId);
    return plans.upsert(reviseNarrativeStrategy(strategy, patch, appClock.now()));
  }

  async function approveStrategy(strategyId, decision = {}) {
    const strategy = await requireStrategy(strategyId);
    const now = appClock.now();
    const approved = await plans.upsert(approveNarrativeStrategy(strategy, now, decision));

    const existing = await plans.list();
    let piece = existing.find((record) => record.kind === "ContentPiece" && record.narrativeStrategyId === approved.narrativeStrategyId);
    if (!piece) {
      piece = await plans.upsert(createPrimaryContentPiece({
        contentPieceId: appIds.create("piece"),
        strategy: approved,
        opportunityId: approved.opportunityId,
        createdAt: now,
      }));
    } else {
      piece = normalizeContentPiece(piece);
    }

    const variants = [];
    for (const destination of ["linkedin", "x"]) {
      let variant = existing.find((record) => record.kind === "PlatformVariant" && record.contentPieceId === piece.contentPieceId && record.destination === destination);
      if (!variant) {
        variant = await plans.upsert(createPlannedPlatformVariant({
          platformVariantId: appIds.create("variant"),
          contentPiece: piece,
          strategy: approved,
          destination,
          createdAt: now,
        }));
      }
      variants.push(normalizePlatformVariant(variant));
    }

    return { strategy: approved, contentPiece: piece, variants };
  }

  async function getPlanBundle(opportunityId) {
    const strategy = await currentStrategyForOpportunity(opportunityId);
    if (!strategy) return { strategy: null, contentPiece: null, variants: [] };
    const all = await plans.list();
    const contentPiece = all.find((record) => record.kind === "ContentPiece" && record.narrativeStrategyId === strategy.narrativeStrategyId) || null;
    const variants = contentPiece
      ? all.filter((record) => record.kind === "PlatformVariant" && record.contentPieceId === contentPiece.contentPieceId).map(normalizePlatformVariant)
      : [];
    return {
      strategy,
      contentPiece: contentPiece ? normalizeContentPiece(contentPiece) : null,
      variants,
    };
  }

  return {
    buildStrategy,
    reviseStrategy,
    approveStrategy,
    currentStrategyForOpportunity,
    getPlanBundle,
  };
}
