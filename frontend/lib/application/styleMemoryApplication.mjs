import { assertPort, createSystemClock, createSystemIdService } from "../domain/ports.mjs";
import {
  FEEDBACK_KINDS,
  LEARNING_ELIGIBILITY,
  STYLE_MEMORY_SCOPES,
  STYLE_MEMORY_STATUSES,
  STYLE_OBSERVATION_DIRECTIONS,
  analyzeRevisionStyleDelta,
  createFeedbackEvent,
  createStyleMemoryHypothesis,
  deriveStyleMemoryState,
  normalizeFeedbackEvent,
  normalizeStyleMemoryHypothesis,
  styleMemoryIdentity,
  styleObservationsFromExplicitReason,
} from "../domain/styleMemory.mjs";
import { PLATFORM_VARIANT_REVISION_ORIGINS, normalizePlatformVariantRevision } from "../domain/platformVariantRevisions.mjs";

function required(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new TypeError(`${field} is required.`);
  return normalized;
}

function scopeForEvent(event, override = null) {
  if (override?.type) return override;
  if (event.platform) return { type: STYLE_MEMORY_SCOPES.PLATFORM, platform: event.platform };
  if (event.projectId) return { type: STYLE_MEMORY_SCOPES.PROJECT, projectId: event.projectId };
  return { type: STYLE_MEMORY_SCOPES.GLOBAL };
}

function eventKey(event) {
  return [
    event.feedbackKind,
    event.targetType,
    event.targetId,
    event.beforeRevisionId || "-",
    event.afterRevisionId || "-",
    event.freeformReason || "-",
  ].join("::");
}

export function createStyleMemoryApplication({
  styleMemoryRepository,
  workspaceId = "local-personal",
  userId = "owner",
  clock = createSystemClock(),
  idService = createSystemIdService("signalflow"),
} = {}) {
  const repository = assertPort("styleMemoryRepository", styleMemoryRepository);
  const appClock = assertPort("clock", clock);
  const appIds = assertPort("idService", idService);
  const ownerWorkspaceId = required(workspaceId, "workspaceId");
  const ownerUserId = required(userId, "userId");

  function assertOwned(record) {
    if (record.workspaceId !== ownerWorkspaceId || record.userId !== ownerUserId) {
      throw new Error(`${record.kind} belongs to another owner/workspace.`);
    }
    return record;
  }

  async function allRecords() {
    return (await repository.list()).map(assertOwned);
  }

  async function listFeedbackEvents() {
    return (await allRecords())
      .filter((record) => record.kind === "FeedbackEvent")
      .map(normalizeFeedbackEvent)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async function listHypotheses({ includeInactive = true } = {}) {
    return (await allRecords())
      .filter((record) => record.kind === "StyleMemoryHypothesis")
      .map(normalizeStyleMemoryHypothesis)
      .filter((record) => includeInactive || [STYLE_MEMORY_STATUSES.ACTIVE, STYLE_MEMORY_STATUSES.USER_CONFIRMED].includes(record.status))
      .sort((left, right) => right.confidence - left.confidence || right.updatedAt.localeCompare(left.updatedAt));
  }

  async function existingEvent(candidate) {
    const key = eventKey(candidate);
    return (await listFeedbackEvents()).find((event) => eventKey(event) === key) || null;
  }

  async function applyObservation(event, observation, { scope = null, approvedRevisionId = null, rejectedRevisionId = null, explicitlyConfirmed = false } = {}) {
    const resolvedScope = scopeForEvent(event, scope);
    const identity = styleMemoryIdentity({ hypothesisKey: observation.hypothesisKey, category: observation.category, scope: resolvedScope });
    const existing = (await listHypotheses()).find((item) => styleMemoryIdentity(item) === identity) || null;
    const supporting = new Set(existing?.supportingFeedbackEventIds || []);
    const contradicting = new Set(existing?.contradictingFeedbackEventIds || []);
    if (observation.direction === STYLE_OBSERVATION_DIRECTIONS.CONTRADICT) contradicting.add(event.feedbackEventId);
    else supporting.add(event.feedbackEventId);
    const nextState = deriveStyleMemoryState({
      supportingCount: supporting.size,
      contradictingCount: contradicting.size,
      explicitlyConfirmed: explicitlyConfirmed || existing?.status === STYLE_MEMORY_STATUSES.USER_CONFIRMED,
    });
    const now = appClock.now();
    const next = createStyleMemoryHypothesis({
      styleMemoryId: existing?.styleMemoryId || appIds.create("style-memory"),
      workspaceId: ownerWorkspaceId,
      userId: ownerUserId,
      hypothesisKey: observation.hypothesisKey,
      hypothesis: observation.hypothesis,
      category: observation.category,
      scope: resolvedScope,
      confidence: nextState.confidence,
      evidenceCount: supporting.size + contradicting.size,
      supportingFeedbackEventIds: [...supporting],
      contradictingFeedbackEventIds: [...contradicting],
      exampleApprovedRevisionIds: Array.from(new Set([...(existing?.exampleApprovedRevisionIds || []), approvedRevisionId].filter(Boolean))),
      exampleRejectedRevisionIds: Array.from(new Set([...(existing?.exampleRejectedRevisionIds || []), rejectedRevisionId].filter(Boolean))),
      status: nextState.status,
      lastEvaluatedAt: now,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    });
    return repository.upsert(next);
  }

  async function recordFeedback(input = {}, { scope = null, approvedRevisionId = null, rejectedRevisionId = null, explicitlyConfirmed = false } = {}) {
    const candidate = createFeedbackEvent({
      feedbackEventId: input.feedbackEventId || appIds.create("feedback"),
      workspaceId: ownerWorkspaceId,
      userId: ownerUserId,
      ...input,
      createdAt: input.createdAt || appClock.now(),
    });
    const duplicate = await existingEvent(candidate);
    const event = duplicate || await repository.upsert(candidate);
    if (event.learningEligibility !== LEARNING_ELIGIBILITY.ELIGIBLE) return { event, hypotheses: [] };
    const hypotheses = [];
    for (const observation of event.structuredReason?.observations || []) {
      hypotheses.push(await applyObservation(event, observation, { scope, approvedRevisionId, rejectedRevisionId, explicitlyConfirmed }));
    }
    return { event, hypotheses };
  }

  async function recordApprovedRevision({ approval, revision, parentRevision = null, projectId = null } = {}) {
    if (!approval || approval.decision !== "approved") throw new TypeError("StyleMemory approval learning requires an exact approved decision.");
    const current = normalizePlatformVariantRevision(revision);
    const parent = parentRevision ? normalizePlatformVariantRevision(parentRevision) : null;
    const edited = current.origin === PLATFORM_VARIANT_REVISION_ORIGINS.EDITED && parent;
    const observations = edited ? analyzeRevisionStyleDelta(parent.content, current.content) : [];
    return recordFeedback({
      targetType: "platform_variant_approval",
      targetId: approval.platformVariantApprovalId,
      platform: current.destination,
      projectId,
      feedbackKind: edited ? FEEDBACK_KINDS.APPROVED_AFTER_EDIT : FEEDBACK_KINDS.APPROVED_UNCHANGED,
      structuredReason: {
        code: edited ? "approved_after_owner_edit" : "approved_without_owner_edit",
        observations,
      },
      beforeRevisionId: parent?.platformVariantRevisionId || null,
      afterRevisionId: current.platformVariantRevisionId,
      learningEligibility: LEARNING_ELIGIBILITY.ELIGIBLE,
      createdAt: approval.decidedAt,
    }, { approvedRevisionId: current.platformVariantRevisionId });
  }

  async function recordChangeRequest({ revision, instruction, projectId = null, createdAt = null } = {}) {
    const current = normalizePlatformVariantRevision(revision);
    const reason = required(instruction, "changeRequest");
    return recordFeedback({
      targetType: "platform_variant_revision",
      targetId: current.platformVariantRevisionId,
      platform: current.destination,
      projectId,
      feedbackKind: FEEDBACK_KINDS.CHANGES_REQUESTED,
      structuredReason: { code: "natural_language_change_request", observations: styleObservationsFromExplicitReason(reason) },
      freeformReason: reason,
      beforeRevisionId: current.platformVariantRevisionId,
      learningEligibility: LEARNING_ELIGIBILITY.ELIGIBLE,
      createdAt: createdAt || appClock.now(),
    });
  }

  async function recordRejection({ approval, revision, projectId = null } = {}) {
    if (!approval || approval.decision !== "rejected") throw new TypeError("StyleMemory rejection learning requires an exact rejected decision.");
    const current = normalizePlatformVariantRevision(revision);
    const note = String(approval.note || "").trim();
    return recordFeedback({
      targetType: "platform_variant_approval",
      targetId: approval.platformVariantApprovalId,
      platform: current.destination,
      projectId,
      feedbackKind: FEEDBACK_KINDS.REJECTED,
      structuredReason: { code: "owner_rejected_revision", observations: styleObservationsFromExplicitReason(note) },
      freeformReason: note || null,
      beforeRevisionId: current.platformVariantRevisionId,
      learningEligibility: note ? LEARNING_ELIGIBILITY.ELIGIBLE : LEARNING_ELIGIBILITY.EXCLUDED_ONE_OFF,
      createdAt: approval.decidedAt,
    }, { rejectedRevisionId: current.platformVariantRevisionId });
  }

  async function recordRegeneration({ revision, projectId = null, createdAt = null } = {}) {
    const current = normalizePlatformVariantRevision(revision);
    return recordFeedback({
      targetType: "platform_variant_revision",
      targetId: current.platformVariantRevisionId,
      platform: current.destination,
      projectId,
      feedbackKind: FEEDBACK_KINDS.REGENERATED,
      structuredReason: { code: "owner_requested_regeneration", observations: [] },
      beforeRevisionId: current.platformVariantRevisionId,
      learningEligibility: LEARNING_ELIGIBILITY.EXCLUDED_ONE_OFF,
      createdAt: createdAt || appClock.now(),
    });
  }

  async function recordExplicitPreference({ reason, platform = null, projectId = null, scope = null } = {}) {
    const preference = required(reason, "preference");
    const observations = styleObservationsFromExplicitReason(preference);
    if (!observations.length) throw new TypeError("The explicit preference does not map to a supported explainable style observation yet.");
    const resolvedScope = scope || (platform ? { type: STYLE_MEMORY_SCOPES.PLATFORM, platform } : projectId ? { type: STYLE_MEMORY_SCOPES.PROJECT, projectId } : { type: STYLE_MEMORY_SCOPES.GLOBAL });
    return recordFeedback({
      targetType: "style_memory",
      targetId: appIds.create("style-note"),
      platform,
      projectId,
      feedbackKind: FEEDBACK_KINDS.EXPLICIT_PREFERENCE,
      structuredReason: { code: "explicit_owner_preference", observations },
      freeformReason: preference,
      learningEligibility: LEARNING_ELIGIBILITY.ELIGIBLE,
      createdAt: appClock.now(),
    }, { scope: resolvedScope, explicitlyConfirmed: true });
  }

  async function confirmHypothesis(styleMemoryId) {
    const stored = await repository.get(required(styleMemoryId, "styleMemoryId"));
    if (!stored || stored.kind !== "StyleMemoryHypothesis") throw new Error(`StyleMemoryHypothesis ${styleMemoryId} does not exist.`);
    const current = assertOwned(normalizeStyleMemoryHypothesis(stored));
    const now = appClock.now();
    return repository.upsert(normalizeStyleMemoryHypothesis({ ...current, status: STYLE_MEMORY_STATUSES.USER_CONFIRMED, confidence: 1, lastEvaluatedAt: now, updatedAt: now }));
  }

  async function rejectHypothesis(styleMemoryId) {
    const stored = await repository.get(required(styleMemoryId, "styleMemoryId"));
    if (!stored || stored.kind !== "StyleMemoryHypothesis") throw new Error(`StyleMemoryHypothesis ${styleMemoryId} does not exist.`);
    const current = assertOwned(normalizeStyleMemoryHypothesis(stored));
    const now = appClock.now();
    return repository.upsert(normalizeStyleMemoryHypothesis({ ...current, status: STYLE_MEMORY_STATUSES.REJECTED, lastEvaluatedAt: now, updatedAt: now }));
  }

  async function forgetHypothesis(styleMemoryId) {
    return repository.remove(required(styleMemoryId, "styleMemoryId"));
  }

  async function resetHypotheses() {
    const hypotheses = await listHypotheses();
    for (const hypothesis of hypotheses) await repository.remove(hypothesis.styleMemoryId);
    return hypotheses.length;
  }

  async function relevantMemory({ platform = null, projectId = null, limit = 8 } = {}) {
    const hypotheses = await listHypotheses({ includeInactive: false });
    const scored = hypotheses
      .filter((item) => item.status !== STYLE_MEMORY_STATUSES.REJECTED && item.status !== STYLE_MEMORY_STATUSES.SUPERSEDED)
      .map((item) => {
        let scopeScore = 1;
        if (item.scope.type === STYLE_MEMORY_SCOPES.PLATFORM) scopeScore = item.scope.platform === platform ? 3 : -1;
        if (item.scope.type === STYLE_MEMORY_SCOPES.PROJECT) scopeScore = item.scope.projectId === projectId ? 4 : -1;
        return { item, score: scopeScore < 0 ? -1 : scopeScore + item.confidence + Math.min(1, item.evidenceCount / 5) };
      })
      .filter(({ score }) => score >= 0)
      .sort((left, right) => right.score - left.score || right.item.updatedAt.localeCompare(left.item.updatedAt))
      .slice(0, Math.max(1, Math.min(20, Number(limit) || 8)))
      .map(({ item }) => ({
        styleMemoryId: item.styleMemoryId,
        hypothesis: item.hypothesis,
        category: item.category,
        scope: item.scope,
        confidence: item.confidence,
        evidenceCount: item.evidenceCount,
        status: item.status,
      }));
    return scored;
  }

  return {
    listFeedbackEvents,
    listHypotheses,
    recordFeedback,
    recordApprovedRevision,
    recordChangeRequest,
    recordRejection,
    recordRegeneration,
    recordExplicitPreference,
    confirmHypothesis,
    rejectHypothesis,
    forgetHypothesis,
    resetHypotheses,
    relevantMemory,
  };
}
