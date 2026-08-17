import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateExplicitBoundaryText,
  IDENTITY_PRECEDENCE,
  IDENTITY_RECORD_KINDS,
} from "../lib/domain/identityProfiles.mjs";
import { createIdentityApplication } from "../lib/application/identityApplication.mjs";
import {
  createBrowserIdentityRepository,
  createMemoryIdentityRepository,
} from "../lib/infrastructure/identityAdapters.mjs";
import { createDeterministicIdService } from "../lib/domain/ports.mjs";

const NOW = "2026-08-17T11:00:00.000Z";

function app(repository = createMemoryIdentityRepository()) {
  return createIdentityApplication({
    identityRepository: repository,
    workspaceId: "local-personal",
    userId: "owner",
    clock: { now: () => NOW },
    idService: createDeterministicIdService("identity-test"),
  });
}

const MINIMAL = {
  primaryTopics: "software systems\nAI products\nscience",
  expertise: "software engineering\ninstrumentation",
  interests: "biology\ndesign",
  backgroundContext: "Engineering broadened an earlier interest in biology and science.",
  desiredAudienceImpressions: "thoughtful builder\nclear systems thinker",
  qualitiesToSignal: "curious\nprecise\ncalm",
  qualitiesToAvoid: "hype-driven founder persona",
  writingPrinciples: "specific over impressive\nexplain trade-offs",
  dislikes: "generic launch copy\nforced engagement questions",
  blockedPhrases: "revolutionary AI platform",
  customBoundaryRules: "never invent customer numbers",
  approvedExamples: "I changed the architecture because the privacy boundary was more important than convenience.",
  linkedinRules: "Use enough context for the reasoning.",
  xRules: "Get to the observation quickly without becoming cryptic.",
};

test("minimal profile creates separate versioned identity records without a giant onboarding dependency", async () => {
  const application = app();
  const saved = await application.saveMinimalProfile(MINIMAL);
  assert.equal(saved.identity.kind, IDENTITY_RECORD_KINDS.IDENTITY);
  assert.equal(saved.perception.kind, IDENTITY_RECORD_KINDS.PERCEPTION);
  assert.equal(saved.voice.kind, IDENTITY_RECORD_KINDS.VOICE);
  assert.equal(saved.boundary.kind, IDENTITY_RECORD_KINDS.BOUNDARY);
  assert.equal(saved.platformExpressions.linkedin.platform, "linkedin");
  assert.equal(saved.platformExpressions.x.platform, "x");
  assert.equal(saved.identity.version, 1);
  assert.deepEqual(saved.identity.primaryTopics, ["software systems", "AI products", "science"]);
});

test("saving explicit profile again appends versions and preserves superseded history", async () => {
  const repository = createMemoryIdentityRepository();
  const application = app(repository);
  const first = await application.saveMinimalProfile(MINIMAL);
  const second = await application.saveMinimalProfile({ ...MINIMAL, primaryTopics: "software systems\nhardware" });
  assert.equal(second.identity.version, 2);
  assert.equal(second.identity.supersedesId, first.identity.identityProfileId);
  const history = await application.getProfileHistory(IDENTITY_RECORD_KINDS.IDENTITY);
  assert.equal(history.length, 2);
  assert.equal(history[0].version, 2);
  assert.equal(history[1].version, 1);
});

test("identity context snapshot freezes exact profile versions and deterministic precedence", async () => {
  const application = app();
  await application.saveMinimalProfile(MINIMAL);
  const snapshot = await application.createIdentityContextSnapshot({
    platform: "linkedin",
    campaignInstructions: ["Focus on the architecture decision, not launch status."],
  });
  assert.equal(snapshot.kind, IDENTITY_RECORD_KINDS.CONTEXT_SNAPSHOT);
  assert.deepEqual(snapshot.precedence, IDENTITY_PRECEDENCE);
  assert.equal(snapshot.profileRefs.identity.version, 1);
  assert.equal(snapshot.profileRefs.platformExpression.version, 1);
  const precedence = snapshot.effectiveRules.map((rule) => rule.precedence);
  assert.ok(precedence.indexOf("explicit_boundary") < precedence.indexOf("campaign_instruction"));
  assert.ok(precedence.indexOf("campaign_instruction") < precedence.indexOf("platform_preference"));
  assert.ok(precedence.indexOf("platform_preference") < precedence.indexOf("global_identity_voice"));
});

test("explicit boundary and project prohibited claim can block text before publication", async () => {
  const application = app();
  await application.saveMinimalProfile(MINIMAL);
  await application.saveProjectGuidance({
    projectId: "signalflow",
    approvedFacts: ["SignalFlow has manual ContentSignal intake."],
    prohibitedClaims: ["fully autonomous publishing"],
  });
  const snapshot = await application.createIdentityContextSnapshot({ platform: "linkedin", projectId: "signalflow" });
  const direct = evaluateExplicitBoundaryText("Our revolutionary AI platform enables fully autonomous publishing.", snapshot);
  assert.equal(direct.allowed, false);
  assert.ok(direct.blocked.some((item) => item.code === "prohibited_project_claim"));
  assert.ok(direct.warnings.some((item) => item.code === "exaggerated_launch_language"));

  const checked = await application.evaluateBoundaries({
    snapshotId: snapshot.identityContextSnapshotId,
    text: "This is a revolutionary AI platform.",
  });
  assert.equal(checked.allowed, true);
  assert.ok(checked.warnings.length > 0);
});

test("browser identity repository survives reopen with historical versions", async () => {
  const storage = new Map();
  const localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, value); },
  };
  const repository = createBrowserIdentityRepository({ getStorage: () => localStorage });
  const application = app(repository);
  await application.saveMinimalProfile(MINIMAL);
  await application.saveMinimalProfile({ ...MINIMAL, interests: "biology\nart" });

  const reopened = app(createBrowserIdentityRepository({ getStorage: () => localStorage }));
  const current = await reopened.getMinimalProfile();
  assert.equal(current.identity.version, 2);
  assert.equal((await reopened.getProfileHistory(IDENTITY_RECORD_KINDS.IDENTITY)).length, 2);
});
