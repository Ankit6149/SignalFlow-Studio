import test from "node:test";
import assert from "node:assert/strict";

import {
  createDomainRecord,
  DOMAIN_CONTRACTS,
  parseDomainRecord,
  portableClone,
  serializeDomainRecord,
} from "../lib/domain/contracts.mjs";

const NOW = "2026-08-30T00:00:00.000Z";

const samples = {
  Workspace: { workspaceId: "workspace-1", name: "Workspace" },
  Project: { projectId: "project-1", name: "Project" },
  ContentSignal: { signalId: "signal-1", workspaceId: "workspace-1", sourceType: "manual", headline: "A thought worth remembering", signalKind: "thought", status: "new", provenance: { source: "manual" } },
  SourceConnection: { sourceConnectionId: "source-connection-1", workspaceId: "workspace-1", provider: "github", status: "active", createdAt: NOW, updatedAt: NOW },
  ContentOpportunity: { opportunityId: "opportunity-1", workspaceId: "workspace-1", signalIds: ["signal-1"], recommendation: "post", title: "Opportunity", status: "proposed", evaluationProvenance: { taskId: "task-1" } },
  ProjectContextSnapshot: { projectContextSnapshotId: "project-context-1", workspaceId: "workspace-1", projectId: "project-1", version: 1, fingerprint: "sf-project-context-v1-test", privacyClass: "workspace_private", synthesis: { projectName: "Project" }, createdAt: NOW },
  IdentityProfile: { identityProfileId: "identity-1", workspaceId: "workspace-1", userId: "user-1", version: 1 },
  PerceptionProfile: { perceptionProfileId: "perception-1", workspaceId: "workspace-1", userId: "user-1", version: 1 },
  VoiceProfile: { voiceProfileId: "voice-1", workspaceId: "workspace-1", userId: "user-1", version: 1 },
  BoundaryProfile: { boundaryProfileId: "boundary-1", workspaceId: "workspace-1", userId: "user-1", version: 1 },
  PlatformExpressionProfile: { platformExpressionProfileId: "platform-expression-1", workspaceId: "workspace-1", userId: "user-1", version: 1, platform: "linkedin" },
  ProjectGuidanceProfile: { projectGuidanceProfileId: "project-guidance-1", workspaceId: "workspace-1", userId: "user-1", version: 1, projectId: "project-1" },
  IdentityContextSnapshot: { identityContextSnapshotId: "identity-context-1", workspaceId: "workspace-1", userId: "user-1", profileRefs: {}, precedence: ["explicit_boundary"], createdAt: NOW },
  NarrativeStrategy: { narrativeStrategyId: "strategy-1", workspaceId: "workspace-1", opportunityId: "opportunity-1", status: "draft", selectedAngle: { angleId: "angle-1" }, identityContextSnapshotId: "identity-context-1", coreIdea: "Privacy constraints changed the architecture.", audienceTakeaway: "Trust boundaries shape product architecture." },
  ContentPiece: { contentPieceId: "piece-1", workspaceId: "workspace-1", narrativeStrategyId: "strategy-1", opportunityId: "opportunity-1", status: "planned", canonicalIntent: "Explain the privacy-driven architecture decision." },
  PlatformVariant: { platformVariantId: "variant-1", workspaceId: "workspace-1", contentPieceId: "piece-1", narrativeStrategyId: "strategy-1", destination: "linkedin", status: "planned" },
  PlatformVariantRevision: { platformVariantRevisionId: "variant-revision-1", workspaceId: "workspace-1", platformVariantId: "variant-1", contentPieceId: "piece-1", narrativeStrategyId: "strategy-1", destination: "linkedin", revisionNumber: 1, strategyRevision: 1, content: "Reviewable LinkedIn draft.", identityContextSnapshotId: "identity-context-1", origin: "generated", createdAt: NOW },
  PlatformVariantReview: { platformVariantReviewId: "variant-review-1", workspaceId: "workspace-1", platformVariantId: "variant-1", platformVariantRevisionId: "variant-revision-1", contentPieceId: "piece-1", narrativeStrategyId: "strategy-1", sourceSignalId: "signal-1", identityContextSnapshotId: "identity-context-1", destination: "linkedin", strategyRevision: 1, overallVerdict: "pass", evidence: { verdict: "pass" }, authenticity: { verdict: "pass" }, createdAt: NOW },
  PlatformVariantApproval: { platformVariantApprovalId: "variant-approval-1", workspaceId: "workspace-1", platformVariantId: "variant-1", platformVariantRevisionId: "variant-revision-1", destination: "linkedin", decision: "approved", decidedBy: "owner", decidedAt: NOW },
  NarrativeMemory: { narrativeMemoryId: "memory-1", workspaceId: "workspace-1", opportunityId: "opportunity-1", narrativeStrategyId: "strategy-1", contentPieceId: "piece-1", platformVariantId: "variant-1", platformVariantRevisionId: "variant-revision-1", platformVariantApprovalId: "variant-approval-1", platform: "linkedin", historyStrength: "prepared_internal", topic: "Privacy routing", angle: "Architecture trade-off", coreIdea: "Privacy constraints changed the architecture.", semanticFingerprint: "sf-narrative-v1-test", approvedAt: NOW, createdAt: NOW },
  FeedbackEvent: { feedbackEventId: "feedback-1", workspaceId: "workspace-1", userId: "user-1", targetType: "platform_variant_revision", targetId: "variant-revision-1", feedbackKind: "changes_requested", learningEligibility: "eligible", createdAt: NOW },
  StyleMemoryHypothesis: { styleMemoryId: "style-memory-1", workspaceId: "workspace-1", userId: "user-1", hypothesisKey: "tone.restrained", hypothesis: "Prefer restrained language.", category: "promotion", scope: { type: "platform" }, confidence: 0.7, evidenceCount: 2, status: "active", lastEvaluatedAt: NOW, createdAt: NOW, updatedAt: NOW },
  MediaIntentResolution: { mediaIntentResolutionId: "media-intent-1", workspaceId: "workspace-1", scopeType: "content_piece", scopeId: "piece-1", status: "ready", bindingIds: ["asset-role-binding-1"], createdAt: NOW, updatedAt: NOW },
  AssetRoleBinding: { assetRoleBindingId: "asset-role-binding-1", workspaceId: "workspace-1", scopeType: "content_piece", scopeId: "piece-1", assetId: "asset-1", role: "final_candidate", usePolicy: { publicUseAllowed: true }, status: "ready", createdAt: NOW, updatedAt: NOW },
  AssetLineage: { assetLineageId: "asset-lineage-1", workspaceId: "workspace-1", assetId: "asset-derived-1", assetVersionId: "asset-derived-v1", parentAssetVersionIds: ["asset-source-v1"], transformation: "crop", createdAt: NOW },
  MediaDecision: { mediaDecisionId: "media-decision-1", workspaceId: "workspace-1", contentPieceId: "piece-1", revision: 1, status: "ready", destinationDecisions: [{ destination: "linkedin", selectedKind: "none" }], createdAt: NOW, updatedAt: NOW },
  MediaRequirement: { mediaRequirementId: "media-requirement-1", workspaceId: "workspace-1", contentPieceId: "piece-1", destination: "linkedin", mediaKind: "none", purpose: "No media adds value to this content piece.", status: "satisfied", createdAt: NOW, updatedAt: NOW },
  ScreenshotQualityReview: { screenshotQualityReviewId: "screenshot-quality-1", workspaceId: "workspace-1", assetId: "asset-1", assetVersionId: "asset-version-1", status: "needs_review", checks: {}, createdAt: NOW, updatedAt: NOW },
  ImageDerivativePlan: { imageDerivativePlanId: "image-derivative-plan-1", workspaceId: "workspace-1", sourceAssetId: "asset-1", sourceAssetVersionId: "asset-version-1", screenshotQualityReviewId: "screenshot-quality-1", variants: [{ variantId: "variant-16x9", aspectRatio: "16:9", targetDimensions: { width: 1600, height: 900 }, crop: { x: 0, y: 0, width: 1440, height: 810 }, status: "needs_review", issueCodes: [] }], status: "needs_review", createdAt: NOW, updatedAt: NOW },
  DurableJob: { jobId: "durable-job-1", workspaceId: "workspace-1", jobType: "capture", resourceType: "capture_job", resourceId: "capture-job-1", idempotencyKey: "capture:workspace-1:capture-job-1", status: "queued", createdAt: NOW, updatedAt: NOW },
  CaptureRecipe: { captureRecipeId: "capture-recipe-1", workspaceId: "workspace-1", projectId: "project-1", version: 1, targetOrigin: "https://preview.example.test", allowedEnvironment: "preview", steps: [{ action: "navigate" }], status: "active", createdAt: NOW, updatedAt: NOW },
  CaptureJob: { captureJobId: "capture-job-1", workspaceId: "workspace-1", captureRecipeId: "capture-recipe-1", captureRecipeVersion: 1, jobId: "durable-job-1", status: "queued", createdAt: NOW, updatedAt: NOW },
  Campaign: { campaignId: "campaign-1", title: "Campaign", drafts: { linkedin: {} } },
  SourceSnapshot: { sourceSnapshotId: "source-snapshot-1", fingerprint: "sf1" },
  SourceArtifact: { sourceArtifactId: "source-artifact-1", artifactType: "note" },
  Asset: { assetId: "asset-1", assetType: "image" },
  AssetProcessing: { processingId: "processing-1", sourceArtifactId: "source-artifact-1", status: "queued" },
  GenerationJob: { generationJobId: "generation-job-1", status: "queued" },
  GenerationRun: { generationRunId: "generation-run-1", provider: "test" },
  ChannelDraft: { draftId: "draft-1", channel: "linkedin", current: { content: "Draft" } },
  DraftRevision: { revisionId: "revision-1", content: "Draft", origin: "generated" },
  Approval: { approvalId: "approval-1", status: "pending" },
  Export: { exportId: "export-1", format: "json" },
  Publication: { publicationId: "publication-1", channel: "linkedin", status: "pending" },
  Connection: { connectionId: "connection-1", provider: "linkedin", status: "connected" },
  UsageEvent: { usageEventId: "usage-1", eventType: "generation" },
  AuditEvent: { auditEventId: "audit-1", eventType: "content.approved" },
  TransferReport: { transferReportId: "transfer-report-1", archiveId: "archive-1", status: "complete" },
};

test("every declared domain contract creates and round-trips a versioned record", () => {
  assert.deepEqual(Object.keys(samples).sort(), Object.keys(DOMAIN_CONTRACTS).sort());
  for (const [kind, values] of Object.entries(samples)) {
    const record = createDomainRecord(kind, values);
    const serialized = serializeDomainRecord(record);
    assert.deepEqual(parseDomainRecord(serialized, kind), record);
  }
});

test("domain serialization rejects secrets and framework/runtime objects", () => {
  assert.throws(
    () => createDomainRecord("Workspace", { workspaceId: "workspace-1", name: "Workspace", apiKey: "secret" }),
    /forbidden/i,
  );
  assert.throws(() => portableClone({ file: new Date() }), /non-portable Date/i);
  assert.throws(() => portableClone({ request: { method: "POST" } }), /forbidden/i);
});

test("domain records require their invariant fields and supported schema", () => {
  assert.throws(() => createDomainRecord("Campaign", { campaignId: "campaign-1", title: "Campaign" }), /drafts is required/i);
  assert.throws(
    () => parseDomainRecord({ schemaVersion: 99, kind: "Workspace", workspaceId: "w", name: "W" }),
    /unsupported domain schema/i,
  );
});
