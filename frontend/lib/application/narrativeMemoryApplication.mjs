import { assertPort, createSystemClock, createSystemIdService } from "../domain/ports.mjs";
import { normalizeContentOpportunity } from "../domain/contentOpportunities.mjs";
import {
  normalizeContentPiece,
  normalizeNarrativeStrategy,
  normalizePlatformVariant,
} from "../domain/contentPlanning.mjs";
import { normalizePlatformVariantRevision } from "../domain/platformVariantRevisions.mjs";
import {
  APPROVAL_DECISIONS,
  normalizePlatformVariantApproval,
} from "../domain/platformVariantReviews.mjs";
import {
  buildNarrativeRepetitionReport,
  createPreparedNarrativeMemory,
  normalizeNarrativeMemory,
} from "../domain/narrativeMemory.mjs";

function required(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new TypeError(`${field} is required.`);
  return normalized;
}

export function createNarrativeMemoryApplication({
  narrativeMemoryRepository,
  workspaceId = "local-personal",
  clock = createSystemClock(),
  idService = createSystemIdService("signalflow"),
} = {}) {
  const memories = assertPort("narrativeMemoryRepository", narrativeMemoryRepository);
  const appClock = assertPort("clock", clock);
  const appIds = assertPort("idService", idService);
  const ownerWorkspaceId = required(workspaceId, "workspaceId");

  function assertOwned(record) {
    if (record.workspaceId !== ownerWorkspaceId) throw new Error(`${record.kind} belongs to another workspace.`);
    return record;
  }

  async function listMemory({ projectId = null, platforms = [], limit = 60 } = {}) {
    const requestedPlatforms = new Set((platforms || []).map((item) => String(item || "").toLowerCase()).filter(Boolean));
    return (await memories.list())
      .map((item) => assertOwned(normalizeNarrativeMemory(item)))
      .filter((item) => !projectId || !item.projectId || item.projectId === projectId)
      .filter((item) => requestedPlatforms.size === 0 || requestedPlatforms.has(item.platform))
      .slice(0, Math.max(1, Math.min(200, Number(limit || 60))));
  }

  async function findForApproval(approvalId) {
    const normalizedId = required(approvalId, "platformVariantApprovalId");
    return (await listMemory({ limit: 200 })).find((item) => item.platformVariantApprovalId === normalizedId) || null;
  }

  async function findForRevision(revisionId) {
    const normalizedId = required(revisionId, "platformVariantRevisionId");
    return (await listMemory({ limit: 200 })).find((item) => item.platformVariantRevisionId === normalizedId) || null;
  }

  async function recordApprovedVariant({
    approval: approvalInput,
    variant: variantInput,
    revision: revisionInput,
    strategy: strategyInput,
    contentPiece: pieceInput,
    opportunity: opportunityInput,
    mediaAssetIds = [],
  } = {}) {
    const approval = assertOwned(normalizePlatformVariantApproval(approvalInput));
    if (approval.decision !== APPROVAL_DECISIONS.APPROVED) {
      throw new TypeError("NarrativeMemory positive story history requires an exact approved revision.");
    }
    const variant = assertOwned(normalizePlatformVariant(variantInput));
    const revision = assertOwned(normalizePlatformVariantRevision(revisionInput));
    const strategy = assertOwned(normalizeNarrativeStrategy(strategyInput));
    const contentPiece = assertOwned(normalizeContentPiece(pieceInput));
    const opportunity = assertOwned(normalizeContentOpportunity(opportunityInput));

    if (approval.platformVariantId !== variant.platformVariantId
      || approval.platformVariantRevisionId !== revision.platformVariantRevisionId
      || revision.platformVariantId !== variant.platformVariantId) {
      throw new Error("NarrativeMemory approval, variant, and revision must bind the same exact revision.");
    }
    if (variant.contentPieceId !== contentPiece.contentPieceId
      || revision.contentPieceId !== contentPiece.contentPieceId
      || variant.narrativeStrategyId !== strategy.narrativeStrategyId
      || revision.narrativeStrategyId !== strategy.narrativeStrategyId
      || contentPiece.narrativeStrategyId !== strategy.narrativeStrategyId
      || strategy.opportunityId !== opportunity.opportunityId) {
      throw new Error("NarrativeMemory planning dependencies do not belong to the same story chain.");
    }
    if (variant.destination !== revision.destination || variant.destination !== approval.destination) {
      throw new Error("NarrativeMemory destination must match the exact approval and revision.");
    }

    const existing = await findForApproval(approval.platformVariantApprovalId);
    if (existing) return existing;
    const revisionExisting = await findForRevision(revision.platformVariantRevisionId);
    if (revisionExisting) return revisionExisting;

    const now = appClock.now();
    return memories.upsert(createPreparedNarrativeMemory({
      narrativeMemoryId: appIds.create("narrative-memory"),
      workspaceId: ownerWorkspaceId,
      projectId: opportunity.projectId || strategy.projectId || null,
      opportunityId: opportunity.opportunityId,
      narrativeStrategyId: strategy.narrativeStrategyId,
      contentPieceId: contentPiece.contentPieceId,
      platformVariantId: variant.platformVariantId,
      platformVariantRevisionId: revision.platformVariantRevisionId,
      platformVariantApprovalId: approval.platformVariantApprovalId,
      platform: variant.destination,
      topic: opportunity.title || contentPiece.canonicalIntent,
      angle: strategy.selectedAngle?.title || strategy.title,
      coreIdea: strategy.coreIdea || contentPiece.canonicalIntent,
      claims: contentPiece.claims,
      evidenceRefs: contentPiece.evidenceRefs,
      mediaAssetIds,
      approvedContent: revision.content,
      approvedAt: approval.decidedAt,
      createdAt: now,
    }));
  }

  async function repetitionReport(candidate, { limit = 60, now = appClock.now() } = {}) {
    const projectId = candidate?.projectId ? String(candidate.projectId).trim() : null;
    const destinations = Array.isArray(candidate?.destinations) ? candidate.destinations : [];
    const relevant = await listMemory({ projectId, platforms: destinations, limit });
    return buildNarrativeRepetitionReport(candidate, relevant, { now });
  }

  async function removeMemory(narrativeMemoryId) {
    const existing = await memories.get(required(narrativeMemoryId, "narrativeMemoryId"));
    if (!existing) return false;
    assertOwned(normalizeNarrativeMemory(existing));
    return memories.remove(narrativeMemoryId);
  }

  return {
    listMemory,
    findForApproval,
    findForRevision,
    recordApprovedVariant,
    repetitionReport,
    removeMemory,
  };
}
