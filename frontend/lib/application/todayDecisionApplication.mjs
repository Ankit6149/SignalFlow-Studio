import { assertPort } from "../domain/ports.mjs";
import { normalizeContentOpportunity } from "../domain/contentOpportunities.mjs";
import { normalizeContentSignal } from "../domain/contentSignals.mjs";
import {
  normalizeContentPiece,
  normalizeNarrativeStrategy,
  normalizePlatformVariant,
  VARIANT_STATUSES,
} from "../domain/contentPlanning.mjs";
import { normalizePlatformVariantRevision } from "../domain/platformVariantRevisions.mjs";
import {
  APPROVAL_DECISIONS,
  normalizePlatformVariantApproval,
  normalizePlatformVariantReview,
  reviewAllowsApproval,
} from "../domain/platformVariantReviews.mjs";

export const TODAY_DECISION_TYPES = Object.freeze({
  PLATFORM_REVIEW: "platform_review",
});

function required(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new TypeError(`${field} is required.`);
  return normalized;
}

function byNewest(records, field) {
  return [...records].sort((a, b) => String(b[field] || "").localeCompare(String(a[field] || "")))[0] || null;
}

function countFindings(review, severity) {
  if (!review) return 0;
  const items = [
    ...(review.boundaryPrecheck?.blocked || []),
    ...(review.boundaryPrecheck?.warnings || []),
    ...(review.evidence?.findings || []),
    ...(review.authenticity?.findings || []),
  ];
  return items.filter((item) => item.severity === severity).length;
}

function selectedAngle(strategy) {
  return {
    angleId: strategy.selectedAngle.angleId,
    title: strategy.selectedAngle.title,
    summary: strategy.selectedAngle.summary,
    approach: strategy.selectedAngle.approach,
  };
}

function reviewSummary(review) {
  const blockers = countFindings(review, "block");
  const warnings = countFindings(review, "warning");
  if (review.overallVerdict === "block") {
    return {
      recommendedAction: "request_change",
      why: blockers === 1
        ? "SignalFlow found one blocking issue. Change or reject this exact revision before it can be approved."
        : `SignalFlow found ${blockers} blocking issues. Change or reject this exact revision before it can be approved.`,
      blockers,
      warnings,
    };
  }
  if (review.overallVerdict === "warn") {
    return {
      recommendedAction: "approve",
      why: warnings === 1
        ? "Evidence and authenticity checks are complete with one warning. Your judgment is the remaining gate."
        : `Evidence and authenticity checks are complete with ${warnings} warnings. Your judgment is the remaining gate.`,
      blockers,
      warnings,
    };
  }
  return {
    recommendedAction: "approve",
    why: "Evidence and authenticity checks passed. Your approval is the remaining gate.",
    blockers,
    warnings,
  };
}

function currentDecisionState(decisions, review) {
  const latest = byNewest(decisions, "decidedAt");
  if (!latest) return { latest: null, approvalValid: false, rejected: false };
  if (latest.decision === APPROVAL_DECISIONS.REJECTED) {
    return { latest, approvalValid: false, rejected: true };
  }
  const approvalValid = Boolean(
    latest.decision === APPROVAL_DECISIONS.APPROVED
      && latest.platformVariantReviewId === review.platformVariantReviewId
      && reviewAllowsApproval(review),
  );
  return { latest, approvalValid, rejected: false };
}

function requiredMediaPending(strategy, revision) {
  const required = (strategy?.mediaRequirements || []).some((item) => {
    const type = String(item?.type || "").trim().toLowerCase();
    return item?.required === true && !["", "none", "text_only"].includes(type);
  });
  return Boolean(required && !(revision?.mediaBindings || []).length);
}

export function projectOwnerDecisions({
  planningRecords = [],
  reviewRecords = [],
  signalRecords = [],
  opportunityRecords = [],
  workspaceId = "local-personal",
} = {}) {
  const ownerWorkspaceId = required(workspaceId, "workspaceId");

  const planning = planningRecords.filter((record) => record?.workspaceId === ownerWorkspaceId);
  const reviewState = reviewRecords.filter((record) => record?.workspaceId === ownerWorkspaceId);
  const signals = signalRecords
    .filter((record) => record?.workspaceId === ownerWorkspaceId && record?.kind === "ContentSignal")
    .map(normalizeContentSignal);
  const opportunities = opportunityRecords
    .filter((record) => record?.workspaceId === ownerWorkspaceId && record?.kind === "ContentOpportunity")
    .map(normalizeContentOpportunity);

  const variants = planning.filter((record) => record?.kind === "PlatformVariant").map(normalizePlatformVariant);
  const revisions = new Map(planning
    .filter((record) => record?.kind === "PlatformVariantRevision")
    .map(normalizePlatformVariantRevision)
    .map((record) => [record.platformVariantRevisionId, record]));
  const pieces = new Map(planning
    .filter((record) => record?.kind === "ContentPiece")
    .map(normalizeContentPiece)
    .map((record) => [record.contentPieceId, record]));
  const strategies = new Map(planning
    .filter((record) => record?.kind === "NarrativeStrategy")
    .map(normalizeNarrativeStrategy)
    .map((record) => [record.narrativeStrategyId, record]));
  const signalById = new Map(signals.map((record) => [record.signalId, record]));
  const opportunityById = new Map(opportunities.map((record) => [record.opportunityId, record]));

  const reviewsByRevision = new Map();
  const decisionsByRevision = new Map();
  for (const record of reviewState) {
    if (record.kind === "PlatformVariantReview") {
      const normalized = normalizePlatformVariantReview(record);
      const items = reviewsByRevision.get(normalized.platformVariantRevisionId) || [];
      items.push(normalized);
      reviewsByRevision.set(normalized.platformVariantRevisionId, items);
    } else if (record.kind === "PlatformVariantApproval") {
      const normalized = normalizePlatformVariantApproval(record);
      const items = decisionsByRevision.get(normalized.platformVariantRevisionId) || [];
      items.push(normalized);
      decisionsByRevision.set(normalized.platformVariantRevisionId, items);
    }
  }

  const projected = [];
  for (const variant of variants) {
    if (!variant.currentRevisionId || [VARIANT_STATUSES.OMITTED, VARIANT_STATUSES.FAILED].includes(variant.status)) continue;
    const revision = revisions.get(variant.currentRevisionId);
    if (!revision || revision.platformVariantId !== variant.platformVariantId) continue;
    const review = byNewest(reviewsByRevision.get(revision.platformVariantRevisionId) || [], "createdAt");
    if (!review) continue;

    const decisionState = currentDecisionState(decisionsByRevision.get(revision.platformVariantRevisionId) || [], review);
    if (decisionState.approvalValid || decisionState.rejected) continue;

    const strategy = strategies.get(variant.narrativeStrategyId);
    const piece = pieces.get(variant.contentPieceId);
    const signal = signalById.get(review.sourceSignalId) || null;
    const opportunity = strategy ? opportunityById.get(strategy.opportunityId) || null : null;
    if (!strategy || !piece) continue;
    if (requiredMediaPending(strategy, revision)) continue;

    const summary = reviewSummary(review);
    projected.push({
      decisionId: `platform-review:${variant.platformVariantId}:${revision.platformVariantRevisionId}`,
      type: TODAY_DECISION_TYPES.PLATFORM_REVIEW,
      workspaceId: ownerWorkspaceId,
      platformVariantId: variant.platformVariantId,
      platformVariantRevisionId: revision.platformVariantRevisionId,
      platformVariantReviewId: review.platformVariantReviewId,
      destination: variant.destination,
      revisionNumber: revision.revisionNumber,
      format: revision.format,
      content: revision.content,
      segments: revision.segments,
      mediaBindings: revision.mediaBindings,
      revisionOrigin: revision.origin,
      parentRevisionId: revision.parentRevisionId,
      changeRequest: revision.changeRequest,
      generationProvenance: revision.generationProvenance,
      editProvenance: revision.editProvenance,
      mediaChangeProvenance: revision.mediaChangeProvenance,
      identityContextSnapshotId: revision.identityContextSnapshotId,
      reviewVerdict: review.overallVerdict,
      evidenceVerdict: review.evidence.verdict,
      authenticityVerdict: review.authenticity.verdict,
      boundaryVerdict: review.boundaryPrecheck.verdict,
      evidenceSummary: review.evidence.summary,
      authenticitySummary: review.authenticity.summary,
      findings: [
        ...(review.boundaryPrecheck?.blocked || []),
        ...(review.boundaryPrecheck?.warnings || []),
        ...(review.evidence?.findings || []),
        ...(review.authenticity?.findings || []),
      ],
      blockers: summary.blockers,
      warnings: summary.warnings,
      recommendedAction: summary.recommendedAction,
      why: summary.why,
      sourceSignal: signal ? {
        signalId: signal.signalId,
        headline: signal.headline,
        summary: signal.summary,
        signalKind: signal.signalKind,
        observedAt: signal.observedAt,
      } : null,
      opportunity: opportunity ? {
        opportunityId: opportunity.opportunityId,
        title: opportunity.title,
        whyNow: opportunity.whyNow,
        score: opportunity.score,
      } : null,
      strategy: {
        narrativeStrategyId: strategy.narrativeStrategyId,
        strategyRevision: strategy.strategyRevision,
        title: strategy.title,
        coreIdea: strategy.coreIdea,
        audienceTakeaway: strategy.audienceTakeaway,
        selectedAngle: selectedAngle(strategy),
      },
      contentPiece: {
        contentPieceId: piece.contentPieceId,
        canonicalIntent: piece.canonicalIntent,
        purpose: piece.purpose,
      },
      reviewedAt: review.createdAt,
      createdAt: revision.createdAt,
    });
  }

  const deduped = new Map();
  for (const item of projected) deduped.set(item.decisionId, item);
  return [...deduped.values()].sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt) || a.decisionId.localeCompare(b.decisionId));
}

export function createTodayDecisionApplication({
  contentPlanningRepository,
  contentReviewRepository,
  contentSignalRepository,
  contentOpportunityRepository,
  workspaceId = "local-personal",
} = {}) {
  const planning = assertPort("contentPlanningRepository", contentPlanningRepository);
  const reviews = assertPort("contentReviewRepository", contentReviewRepository);
  const signals = assertPort("contentSignalRepository", contentSignalRepository);
  const opportunities = assertPort("contentOpportunityRepository", contentOpportunityRepository);
  const ownerWorkspaceId = required(workspaceId, "workspaceId");

  async function listDecisions() {
    const [planningRecords, reviewRecords, signalRecords, opportunityRecords] = await Promise.all([
      planning.list(),
      reviews.list(),
      signals.list(),
      opportunities.list(),
    ]);
    return projectOwnerDecisions({
      planningRecords,
      reviewRecords,
      signalRecords,
      opportunityRecords,
      workspaceId: ownerWorkspaceId,
    });
  }

  return { listDecisions };
}
