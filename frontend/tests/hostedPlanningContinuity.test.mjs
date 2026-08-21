import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createIdentityApplication } from "../lib/application/identityApplication.mjs";
import { createBrowserPlanOpportunityApplication, profileInput } from "../lib/application/browserPlanOpportunityApplication.mjs";
import { createNarrativeStrategy } from "../lib/domain/contentPlanning.mjs";
import { createDeterministicIdService } from "../lib/domain/ports.mjs";
import { createMemoryIdentityRepository } from "../lib/infrastructure/identityAdapters.mjs";
import { createPostgresContentPlanningRepository, planningRecordFromRow } from "../lib/infrastructure/postgresContentPlanningAdapter.mjs";
import { createPostgresIdentityRepository, identityFromRow } from "../lib/infrastructure/postgresIdentityAdapter.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const NOW = "2026-08-21T18:30:00.000Z";

function read(relativePath) {
  return fs.readFileSync(path.join(here, relativePath), "utf8");
}

const MINIMAL = {
  primaryTopics: "software systems\nAI products",
  expertise: "software engineering",
  interests: "science\ndesign",
  backgroundContext: "Builds software and engineering systems.",
  desiredAudienceImpressions: "thoughtful builder\nclear systems thinker",
  qualitiesToSignal: "precise\ncalm",
  qualitiesToAvoid: "hype-driven persona",
  writingPrinciples: "specific over impressive\nexplain trade-offs",
  dislikes: "generic launch copy\nforced engagement questions",
  blockedPhrases: "revolutionary AI platform",
  customBoundaryRules: "never invent customer numbers",
  approvedExamples: "I changed the architecture because the privacy boundary mattered more than convenience.",
  linkedinRules: "Use enough context for the reasoning.",
  xRules: "Get to the observation quickly without becoming cryptic.",
};

async function savedIdentity() {
  const application = createIdentityApplication({
    identityRepository: createMemoryIdentityRepository(),
    workspaceId: "owner-local",
    userId: "owner",
    clock: { now: () => NOW },
    idService: createDeterministicIdService("hosted-identity-test"),
  });
  return application.saveMinimalProfile(MINIMAL);
}

function strategy() {
  return createNarrativeStrategy({
    narrativeStrategyId: "strategy-1",
    workspaceId: "owner-local",
    opportunityId: "opportunity-1",
    projectId: "project-1",
    inputFingerprint: "fingerprint-1",
    selectedAngle: {
      angleId: "angle-1",
      title: "Explain the architecture decision",
      summary: "Lead with the trade-off instead of launch hype.",
      approach: "Explain what changed, why, and what it enables.",
      selectionOrigin: "owner",
    },
    identityContextSnapshotId: "identity-snapshot-1",
    proposal: {
      title: "Architecture decision",
      coreIdea: "The architecture changed to preserve a stronger product boundary.",
      audienceTakeaway: "Readers should understand the reasoning, not just the implementation.",
      narrativeArc: ["State the constraint", "Explain the decision", "Show the consequence"],
      hookDirection: "Start from the surprising constraint.",
      evidencePlan: ["Use the approved repository evidence."],
      factualConstraints: ["Do not claim external publication support."],
      boundaryConstraints: ["Do not invent metrics."],
      destinationPlan: [
        { destination: "linkedin", decision: "include", reason: "The reasoning benefits from context.", format: "single narrative post" },
        { destination: "x", decision: "optional", reason: "Use only if it remains coherent when compact.", format: "single post or short thread" },
      ],
      mediaRequirements: [],
      sequencingNotes: [],
    },
    taskId: "task-1",
    createdAt: NOW,
  });
}

test("hosted identity/planning migration is relational, workspace-safe and destination-extensible", () => {
  const migration = read("../db/migrations/0005_hosted_identity_planning.sql");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS sf_identity_records/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS sf_content_planning_records/);
  assert.match(migration, /FOREIGN KEY \(workspace_id, opportunity_id\)[\s\S]*REFERENCES sf_content_opportunities \(workspace_id, opportunity_id\)/);
  assert.match(migration, /FOREIGN KEY \(workspace_id, narrative_strategy_id\)[\s\S]*REFERENCES sf_content_planning_records \(workspace_id, record_id\)/);
  assert.match(migration, /FOREIGN KEY \(workspace_id, content_piece_id\)[\s\S]*REFERENCES sf_content_planning_records \(workspace_id, record_id\)/);
  assert.doesNotMatch(migration, /CHECK\s*\(destination\s+IN/i);
  assert.doesNotMatch(migration, /\b(bytea|base64|access_token|refresh_token|api_key|secret)\b/i);
});

test("Postgres identity row mapping preserves canonical record identity and rejects cross-owner writes before SQL", async () => {
  const saved = await savedIdentity();
  const record = saved.identity;
  const mapped = identityFromRow({
    record_id: record.identityProfileId,
    workspace_id: record.workspaceId,
    user_id: record.userId,
    record_kind: record.kind,
    scope_key: "global",
    record_version: record.version,
    record,
  });
  assert.deepEqual(mapped, record);

  let queries = 0;
  const repository = createPostgresIdentityRepository({
    database: { async query() { queries += 1; return { rows: [] }; } },
    workspaceId: "owner-local",
    userId: "owner",
  });
  await assert.rejects(
    repository.upsert({ ...record, workspaceId: "tenant-b" }),
    (error) => error?.code === "postgres_identity_scope_mismatch",
  );
  assert.equal(queries, 0);
});

test("Postgres planning row mapping preserves canonical strategy and rejects cross-workspace writes before SQL", async () => {
  const record = strategy();
  const mapped = planningRecordFromRow({
    record_id: record.narrativeStrategyId,
    workspace_id: record.workspaceId,
    record_kind: record.kind,
    opportunity_id: record.opportunityId,
    narrative_strategy_id: null,
    content_piece_id: null,
    destination: null,
    status: record.status,
    record,
  });
  assert.deepEqual(mapped, record);

  let queries = 0;
  const repository = createPostgresContentPlanningRepository({
    database: { async query() { queries += 1; return { rows: [] }; } },
    workspaceId: "owner-local",
  });
  await assert.rejects(
    repository.upsert({ ...record, workspaceId: "tenant-b" }),
    (error) => error?.code === "postgres_workspace_scope_mismatch",
  );
  assert.equal(queries, 0);
});

test("connected-source planning syncs explicit Voice by value, never copies local profile IDs, and stays on hosted planning", async () => {
  const localProfile = await savedIdentity();
  const plain = profileInput(localProfile);
  const entry = {
    origin: "hosted",
    opportunity: {
      opportunityId: "opportunity-1",
      selectedAngleId: "angle-1",
    },
  };
  let saves = 0;
  let builds = 0;
  let capturedProfile = null;
  const application = createBrowserPlanOpportunityApplication({
    getStorage: () => null,
    localApplication: {},
    hostedClient: {},
    identityApplication: { async getMinimalProfile() { return localProfile; } },
    hostedIdentityClient: {
      async getMinimalProfile() { return { workspaceId: "owner-local", userId: "owner", profile: {} }; },
      async saveMinimalProfile(profile) { saves += 1; capturedProfile = profile; return { workspaceId: "owner-local", userId: "owner", profile: {} }; },
    },
    hostedPlanningClient: {
      async buildStrategy(opportunityId) { builds += 1; return { opportunityId, strategy: null, contentPiece: null, variants: [] }; },
    },
  });

  await application.buildHostedPlan(entry);
  assert.equal(saves, 1);
  assert.equal(builds, 1);
  assert.deepEqual(capturedProfile, plain);
  assert.equal("identityProfileId" in capturedProfile, false);
  assert.equal("workspaceId" in capturedProfile, false);
  assert.equal("userId" in capturedProfile, false);
});

test("matching hosted explicit Voice avoids needless profile version churn", async () => {
  const localProfile = await savedIdentity();
  let saves = 0;
  const application = createBrowserPlanOpportunityApplication({
    getStorage: () => null,
    localApplication: {},
    hostedClient: {},
    identityApplication: { async getMinimalProfile() { return localProfile; } },
    hostedIdentityClient: {
      async getMinimalProfile() { return { workspaceId: "owner-local", userId: "owner", profile: localProfile }; },
      async saveMinimalProfile() { saves += 1; return { profile: localProfile }; },
    },
    hostedPlanningClient: {
      async buildStrategy() { return { strategy: null, contentPiece: null, variants: [] }; },
    },
  });
  await application.buildHostedPlan({ origin: "hosted", opportunity: { opportunityId: "opportunity-1", selectedAngleId: "angle-1" } });
  assert.equal(saves, 0);
});

test("hosted planning APIs remain owner-only, JSON-bounded and exact-revision safe", () => {
  const identityRoute = read("../app/api/identity/route.js");
  const planningRoute = read("../app/api/planning/route.js");
  assert.match(identityRoute, /requireOwnerAccess/);
  assert.match(planningRoute, /requireOwnerAccess/);
  assert.match(identityRoute, /application\/json/);
  assert.match(planningRoute, /application\/json/);
  assert.match(planningRoute, /expectedStrategyRevision/);
  assert.match(planningRoute, /planning_stale_strategy/);
  assert.match(planningRoute, /PATCH_FIELDS/);
  assert.doesNotMatch(planningRoute, /localStorage|CampaignPlanPanel|generateJSON/);
});

test("Plan replaces the old hosted handoff placeholder with real durable strategy judgment", () => {
  const plan = read("../components/PlanWorkspace.js");
  const hostedPanel = read("../components/HostedCampaignPlanPanel.js");
  assert.match(plan, /HostedCampaignPlanPanel/);
  assert.match(hostedPanel, /application\.getHostedPlan/);
  assert.match(hostedPanel, /application\.buildHostedPlan/);
  assert.match(hostedPanel, /application\.approveHostedPlan/);
  assert.match(hostedPanel, /strategyMatchesOpportunity/);
  assert.match(hostedPanel, /CANONICAL CONTENT PIECE/);
  assert.doesNotMatch(hostedPanel, /localStorage|\/api\/intelligence\/strategy/);
  assert.doesNotMatch(hostedPanel, /from\s+["'][^"']*CampaignPlanPanel(?:\.[^"']*)?["']/);
  assert.doesNotMatch(plan, /hosted strategy\/production continuity is the next durable layer/i);
});
