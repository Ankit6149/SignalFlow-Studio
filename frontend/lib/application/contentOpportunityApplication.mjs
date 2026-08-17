import {
  assertPort,
  createSystemClock,
  createSystemIdService,
} from "../domain/ports.mjs";
import {
  CONTENT_OPPORTUNITY_STATUSES,
  createContentOpportunity,
  deterministicSkipEvaluation,
  normalizeContentOpportunity,
  opportunityInputFingerprint,
  selectOpportunityAngle,
  setCustomOpportunityAngle,
  transitionContentOpportunity,
} from "../domain/contentOpportunities.mjs";
import {
  CONTENT_SIGNAL_STATUSES,
  normalizeContentSignal,
  transitionContentSignal,
} from "../domain/contentSignals.mjs";
import {
  createInferenceTask,
  INFERENCE_TASK_TYPES,
  minimizeSignalForOpportunity,
} from "../inference/inferenceTasks.mjs";

function normalizeWorkspaceId(value) {
  const workspaceId = String(value || "").trim();
  if (!workspaceId) throw new TypeError("ContentOpportunity application requires a workspaceId.");
  return workspaceId;
}

function obviousSkipReason(signal) {
  if ([CONTENT_SIGNAL_STATUSES.IGNORED, CONTENT_SIGNAL_STATUSES.ARCHIVED].includes(signal.status)) {
    return "This signal was explicitly removed from active editorial consideration by the user.";
  }
  if (signal.status === CONTENT_SIGNAL_STATUSES.SNOOZED) {
    return "This signal is snoozed and should not be turned into content until the user brings it back.";
  }
  const meaningful = `${signal.headline} ${signal.summary}`.replace(/[^a-z0-9]+/gi, "");
  if (meaningful.length < 3) return "There is not enough meaningful text to evaluate this signal.";
  return null;
}

export function createContentOpportunityApplication({
  contentOpportunityRepository,
  contentSignalRepository,
  inferenceAdapter,
  workspaceId = "local-personal",
  clock = createSystemClock(),
  idService = createSystemIdService("signalflow"),
} = {}) {
  const opportunities = assertPort("contentOpportunityRepository", contentOpportunityRepository);
  const signals = assertPort("contentSignalRepository", contentSignalRepository);
  const inference = assertPort("inferenceAdapter", inferenceAdapter);
  const applicationClock = assertPort("clock", clock);
  const applicationIds = assertPort("idService", idService);
  const ownerWorkspaceId = normalizeWorkspaceId(workspaceId);

  function assertOwnedOpportunity(input) {
    const opportunity = normalizeContentOpportunity(input);
    if (opportunity.workspaceId !== ownerWorkspaceId) {
      throw new Error(`ContentOpportunity ${opportunity.opportunityId} does not belong to workspace ${ownerWorkspaceId}.`);
    }
    return opportunity;
  }

  function assertOwnedSignal(input) {
    const signal = normalizeContentSignal(input);
    if (signal.workspaceId !== ownerWorkspaceId) {
      throw new Error(`ContentSignal ${signal.signalId} does not belong to workspace ${ownerWorkspaceId}.`);
    }
    return signal;
  }

  async function requireOpportunity(opportunityId) {
    const stored = await opportunities.get(String(opportunityId || "").trim());
    if (!stored) throw new Error(`ContentOpportunity ${opportunityId || "missing"} does not exist.`);
    return assertOwnedOpportunity(stored);
  }

  async function requireSignal(signalId) {
    const stored = await signals.get(String(signalId || "").trim());
    if (!stored) throw new Error(`ContentSignal ${signalId || "missing"} does not exist.`);
    return assertOwnedSignal(stored);
  }

  async function listRankedOpportunities({ includeRejected = false } = {}) {
    const stored = await opportunities.list();
    return stored
      .map(assertOwnedOpportunity)
      .filter((item) => includeRejected || ![CONTENT_OPPORTUNITY_STATUSES.REJECTED, CONTENT_OPPORTUNITY_STATUSES.EXPIRED].includes(item.status))
      .sort((left, right) => Number(right.score || 0) - Number(left.score || 0));
  }

  async function readOpportunity(opportunityId) {
    const stored = await opportunities.get(opportunityId);
    return stored ? assertOwnedOpportunity(stored) : null;
  }

  async function findCurrentForSignal(signalId) {
    const signal = await requireSignal(signalId);
    const fingerprint = opportunityInputFingerprint(signal);
    const stored = await listRankedOpportunities({ includeRejected: true });
    return stored.find((item) => item.signalIds.includes(signal.signalId) && item.inputFingerprint === fingerprint) || null;
  }

  async function evaluateSignal(signalId, { refresh = false } = {}) {
    const signal = await requireSignal(signalId);
    const inputFingerprint = opportunityInputFingerprint(signal);
    if (!refresh) {
      const cached = await findCurrentForSignal(signal.signalId);
      if (cached) return cached;
    }

    const now = applicationClock.now();
    const skipReason = obviousSkipReason(signal);
    let evaluation;
    let evaluationProvenance;

    if (skipReason) {
      evaluation = deterministicSkipEvaluation(signal, skipReason);
      evaluationProvenance = {
        taskId: applicationIds.create("task"),
        taskType: INFERENCE_TASK_TYPES.OPPORTUNITY_EVALUATION,
        provider: "deterministic",
        model: "signal-prefilter-v1",
        routeKind: "local",
        evaluatedAt: now,
      };
    } else {
      const task = createInferenceTask({
        taskId: applicationIds.create("task"),
        workspaceId: ownerWorkspaceId,
        taskType: INFERENCE_TASK_TYPES.OPPORTUNITY_EVALUATION,
        dataClassification: signal.privacyClassification,
        inputRefs: [signal.signalId],
        requirements: ["structured_output", "editorial_reasoning"],
        createdAt: now,
      });
      const result = await inference.execute({
        task,
        input: { signal: minimizeSignalForOpportunity(signal) },
      });
      evaluation = result.output;
      evaluationProvenance = result.provenance;
    }

    const opportunity = createContentOpportunity({
      opportunityId: applicationIds.create("opportunity"),
      workspaceId: ownerWorkspaceId,
      projectId: signal.projectId,
      signalIds: [signal.signalId],
      inputFingerprint,
      evaluation,
      evaluationProvenance,
      createdAt: now,
    });
    const persisted = await opportunities.upsert(opportunity);

    if (signal.status === CONTENT_SIGNAL_STATUSES.NEW) {
      await signals.upsert(transitionContentSignal(signal, CONTENT_SIGNAL_STATUSES.INTERPRETED, now));
    }
    return persisted;
  }

  async function selectOpportunity(opportunityId) {
    const current = await requireOpportunity(opportunityId);
    const next = transitionContentOpportunity(current, CONTENT_OPPORTUNITY_STATUSES.SHORTLISTED, applicationClock.now());
    return opportunities.upsert(next);
  }

  async function selectAngle(opportunityId, angleId) {
    const current = await requireOpportunity(opportunityId);
    return opportunities.upsert(selectOpportunityAngle(current, angleId, applicationClock.now()));
  }

  async function setCustomAngle(opportunityId, customAngle) {
    const current = await requireOpportunity(opportunityId);
    return opportunities.upsert(setCustomOpportunityAngle(current, customAngle, applicationClock.now()));
  }

  async function rejectOpportunity(opportunityId) {
    const current = await requireOpportunity(opportunityId);
    return opportunities.upsert(transitionContentOpportunity(current, CONTENT_OPPORTUNITY_STATUSES.REJECTED, applicationClock.now()));
  }

  async function snoozeOpportunity(opportunityId, snoozedUntil) {
    const current = await requireOpportunity(opportunityId);
    const until = new Date(snoozedUntil);
    if (!Number.isFinite(until.getTime())) throw new TypeError("A valid opportunity snooze date is required.");
    const now = new Date(applicationClock.now());
    if (until.getTime() <= now.getTime()) throw new TypeError("Opportunity snooze time must be in the future.");
    return opportunities.upsert(transitionContentOpportunity(
      current,
      CONTENT_OPPORTUNITY_STATUSES.SNOOZED,
      now.toISOString(),
      { snoozedUntil: until.toISOString() },
    ));
  }

  return {
    evaluateSignal,
    listRankedOpportunities,
    readOpportunity,
    findCurrentForSignal,
    selectOpportunity,
    selectAngle,
    setCustomAngle,
    rejectOpportunity,
    snoozeOpportunity,
  };
}
