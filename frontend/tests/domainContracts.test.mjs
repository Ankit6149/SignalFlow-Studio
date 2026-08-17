import test from "node:test";
import assert from "node:assert/strict";

import {
  createDomainRecord,
  DOMAIN_CONTRACTS,
  parseDomainRecord,
  portableClone,
  serializeDomainRecord,
} from "../lib/domain/contracts.mjs";

const samples = {
  Workspace: { workspaceId: "workspace-1", name: "Workspace" },
  Project: { projectId: "project-1", name: "Project" },
  ContentSignal: {
    signalId: "signal-1",
    workspaceId: "workspace-1",
    sourceType: "manual",
    headline: "A thought worth remembering",
    signalKind: "thought",
    status: "new",
    provenance: { source: "manual", ingestionMethod: "user_input" },
  },
  ContentOpportunity: {
    opportunityId: "opportunity-1",
    workspaceId: "workspace-1",
    signalIds: ["signal-1"],
    recommendation: "post",
    title: "Opportunity",
    status: "proposed",
    evaluationProvenance: { taskId: "task-1", provider: "test" },
  },
  NarrativeStrategy: {
    narrativeStrategyId: "strategy-1",
    workspaceId: "workspace-1",
    opportunityId: "opportunity-1",
    status: "draft",
    strategyRevision: 1,
  },
  ContentPiece: {
    contentPieceId: "piece-1",
    workspaceId: "workspace-1",
    narrativeStrategyId: "strategy-1",
    opportunityId: "opportunity-1",
    status: "planned",
  },
  PlatformVariant: {
    platformVariantId: "variant-1",
    workspaceId: "workspace-1",
    contentPieceId: "piece-1",
    narrativeStrategyId: "strategy-1",
    destination: "linkedin",
    status: "planned",
  },
  IdentityProfile: { identityProfileId: "identity-1", workspaceId: "workspace-1", userId: "user-1", version: 1 },
  PerceptionProfile: { perceptionProfileId: "perception-1", workspaceId: "workspace-1", userId: "user-1", version: 1 },
  VoiceProfile: { voiceProfileId: "voice-1", workspaceId: "workspace-1", userId: "user-1", version: 1 },
  BoundaryProfile: { boundaryProfileId: "boundary-1", workspaceId: "workspace-1", userId: "user-1", version: 1 },
  PlatformExpressionProfile: { platformExpressionProfileId: "platform-1", workspaceId: "workspace-1", userId: "user-1", version: 1, platform: "linkedin" },
  ProjectGuidanceProfile: { projectGuidanceProfileId: "project-guidance-1", workspaceId: "workspace-1", userId: "user-1", version: 1, projectId: "project-1" },
  IdentityContextSnapshot: { identityContextSnapshotId: "identity-context-1", workspaceId: "workspace-1", userId: "user-1", profileRefs: {}, precedence: ["explicit_boundary"], createdAt: "2026-08-17T11:00:00.000Z" },
  Campaign: { campaignId: "campaign-1", title: "Campaign", drafts: { linkedin: {} } },
  SourceSnapshot: { sourceSnapshotId: "source-1", fingerprint: "sf1" },
  SourceArtifact: { sourceArtifactId: "artifact-1", artifactType: "note" },
  Asset: { assetId: "asset-1", assetType: "image" },
  AssetProcessing: { processingId: "processing-1", sourceArtifactId: "artifact-1", status: "queued" },
  GenerationJob: { generationJobId: "job-1", status: "queued" },
  GenerationRun: { generationRunId: "run-1", provider: "gemini" },
  ChannelDraft: { draftId: "draft-1", channel: "linkedin", current: { content: "Draft" } },
  DraftRevision: { revisionId: "revision-1", content: "Draft", origin: "generated" },
  Approval: { approvalId: "approval-1", status: "pending" },
  Export: { exportId: "export-1", format: "json" },
  Publication: { publicationId: "publication-1", channel: "linkedin", status: "pending" },
  Connection: { connectionId: "connection-1", provider: "linkedin", status: "connected" },
  UsageEvent: { usageEventId: "usage-1", eventType: "generation" },
  AuditEvent: { auditEventId: "audit-1", eventType: "campaign.saved" },
  TransferReport: { transferReportId: "report-1", archiveId: "archive-1", status: "complete" },
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
  assert.throws(
    () => portableClone({ file: new Date() }),
    /non-portable Date/i,
  );
  assert.throws(
    () => portableClone({ request: { method: "POST" } }),
    /forbidden/i,
  );
});

test("domain records require their invariant fields and supported schema", () => {
  assert.throws(() => createDomainRecord("Campaign", { campaignId: "campaign-1", title: "Campaign" }), /drafts is required/i);
  assert.throws(
    () => parseDomainRecord({ schemaVersion: 99, kind: "Workspace", workspaceId: "w", name: "W" }),
    /unsupported domain schema/i,
  );
});
