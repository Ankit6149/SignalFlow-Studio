import test from "node:test";
import assert from "node:assert/strict";

import { createBrowserContentSignalApplication } from "../lib/application/browserContentSignalApplication.mjs";
import { createBrowserIdentityApplication } from "../lib/application/browserIdentityApplication.mjs";
import { createBrowserGoldenPathAutopilotApplication } from "../lib/application/browserGoldenPathAutopilotApplication.mjs";
import { createBrowserTodayDecisionApplication } from "../lib/application/browserTodayDecisionApplication.mjs";
import { createBrowserPlatformReviewApplication } from "../lib/application/browserPlatformReviewApplication.mjs";
import { createBrowserPlatformChangeRequestApplication } from "../lib/application/browserPlatformChangeRequestApplication.mjs";
import { createBrowserStyleMemoryApplication } from "../lib/application/browserStyleMemoryApplication.mjs";
import { createNarrativeMemoryApplication } from "../lib/application/narrativeMemoryApplication.mjs";
import { createBrowserContentPlanningRepository } from "../lib/infrastructure/contentPlanningAdapters.mjs";
import { createBrowserContentOpportunityRepository } from "../lib/infrastructure/contentOpportunityAdapters.mjs";
import { createBrowserContentReviewRepository } from "../lib/infrastructure/contentReviewAdapters.mjs";
import { createBrowserNarrativeMemoryRepository } from "../lib/infrastructure/narrativeMemoryAdapters.mjs";

const WORKSPACE_ID = "local-personal";
const NOW = "2026-08-18T17:15:00.000Z";

function createStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    clear() { values.clear(); },
  };
}

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return JSON.stringify(payload); },
  };
}

function opportunityOutput() {
  return {
    recommendation: "post",
    title: "Privacy is an execution boundary",
    summary: "Explain why privacy changed routing architecture rather than becoming another settings toggle.",
    whyNow: "The implementation decision is recent, concrete, and useful to builders designing private AI systems.",
    score: 91,
    scoreBreakdown: {
      freshness: 92,
      importance: 88,
      novelty: 84,
      audienceValue: 89,
      narrativeFit: 92,
      evidenceStrength: 90,
    },
    confidence: 0.93,
    evidenceReadiness: { level: "strong", reason: "The architectural decision is directly described in the source Signal." },
    narrativeFit: { level: "strong", reason: "The Signal contains a concrete constraint, decision, and engineering trade-off." },
    repetitionRisk: { level: "unknown", reason: "No relevant NarrativeMemory exists yet." },
    candidateAngles: [
      { title: "Architecture boundary", summary: "Show how privacy changes routing architecture.", approach: "Lead with the constraint, then the architectural consequence." },
      { title: "Fail-closed lesson", summary: "Explain why private processing must fail closed.", approach: "Lead with what the system refuses to do silently." },
      { title: "Local-first implication", summary: "Show where local-first architecture becomes necessary.", approach: "Lead with the processing boundary and device implications." },
      { title: "Product principle", summary: "Explain privacy as product behavior rather than a settings label.", approach: "Lead with the user promise and trace it into implementation." },
    ],
    recommendedAngleTitle: "Architecture boundary",
    candidateDestinations: [
      { destination: "linkedin", recommended: true, reason: "The reasoning benefits from context.", format: "single narrative post" },
      { destination: "x", recommended: true, reason: "The core lesson can be concise.", format: "single post" },
    ],
    excludedDestinations: [],
    recommendedMediaTypes: ["text_only"],
    freshnessState: "fresh",
    productionEffortEstimate: "low",
  };
}

function strategyOutput() {
  return {
    title: "Privacy changes the execution architecture",
    coreIdea: "Privacy is an execution boundary: when a Signal is protected, the system must change where inference can run instead of quietly weakening the policy.",
    audienceTakeaway: "A trustworthy AI workflow treats privacy as routing logic and fails closed when an allowed route is unavailable.",
    narrativeArc: [
      "Start with the temptation to treat privacy as a settings toggle.",
      "Show why classification has to participate in inference routing.",
      "End with the fail-closed product behavior and what it protects.",
    ],
    hookDirection: "Open with the engineering consequence of a privacy promise rather than a generic privacy claim.",
    evidencePlan: ["Use only the persisted Signal and its explicit boundary as factual evidence."],
    factualConstraints: ["Do not claim production scale, customer usage, or unimplemented local-model capability."],
    boundaryConstraints: ["Do not expose private repository details or credentials."],
    destinationPlan: [
      { destination: "linkedin", decision: "include", reason: "The trade-off benefits from context.", format: "single narrative post", adaptationNotes: ["Explain the reasoning before implementation detail."] },
      { destination: "x", decision: "include", reason: "The core lesson works as one compact observation.", format: "single post", adaptationNotes: ["Keep the claim narrow and concrete."] },
    ],
    mediaRequirements: [{ type: "text_only", reason: "The architecture lesson is understandable without fabricated visuals.", required: false }],
    sequencingNotes: [],
  };
}

function createInferenceFetch(callLog) {
  return async (url, options = {}) => {
    const body = JSON.parse(options.body || "{}");
    const taskType = body?.task?.taskType;
    const destination = body?.input?.variant?.destination || body?.input?.revision?.destination || body?.input?.parentRevision?.destination || null;
    callLog.push({ url, taskType, destination });

    const provenance = {
      taskId: body?.task?.taskId || "task-acceptance",
      taskType,
      provider: "acceptance-test-provider",
      model: "acceptance-test-model",
      routeKind: "remote",
      evaluatedAt: NOW,
      generatedAt: NOW,
      reviewedAt: NOW,
      promptVersion: `${taskType || "acceptance"}_v1`,
    };

    if (taskType === "opportunity_evaluation") {
      return response({ ok: true, output: opportunityOutput(), provenance });
    }
    if (taskType === "narrative_strategy") {
      return response({ ok: true, output: strategyOutput(), provenance });
    }
    if (taskType === "platform_variant") {
      const output = destination === "x"
        ? {
          format: "single_post",
          content: "Privacy is not a settings toggle. If protected context cannot use an allowed inference route, the system should stop—not silently downgrade the boundary.",
          segments: [],
        }
        : {
          format: "single_post",
          content: "A privacy promise changes the architecture.\n\nIf context is protected, that classification has to participate in inference routing. The system should use a permitted route or stop. Quietly falling back to a remote model would turn privacy into decoration.\n\nPrivacy is not only a setting. It is an execution boundary.",
          segments: [],
        };
      return response({ ok: true, output, provenance });
    }
    if (taskType === "platform_variant_revision") {
      assert.equal(destination, "linkedin", "the acceptance change request intentionally targets LinkedIn");
      assert.match(body?.input?.changeRequest || "", /opening more direct/i);
      return response({
        ok: true,
        output: {
          format: "single_post",
          content: "Privacy changes where inference is allowed to run.\n\nOnce context is protected, routing has to enforce that boundary before model choice. Use a permitted route or stop; do not silently weaken the promise.\n\nThat is the product lesson: privacy is execution behavior, not a settings label.",
          segments: [],
        },
        provenance,
      });
    }
    if (taskType === "evidence_critique") {
      return response({
        ok: true,
        output: { verdict: "pass", summary: "The draft stays within the supplied Signal and approved strategy evidence.", findings: [] },
        provenance,
      });
    }
    if (taskType === "authenticity_critique") {
      return response({
        ok: true,
        output: { verdict: "pass", summary: "The draft remains compatible with the saved Voice and destination expression.", findings: [] },
        provenance,
      });
    }
    return response({ ok: false, code: "unexpected_acceptance_task", error: `Unexpected acceptance inference task: ${taskType || url}` }, 400);
  };
}

async function seedOwnerContext({ storage, fetchImpl }) {
  const getStorage = () => storage;
  const identity = createBrowserIdentityApplication({ getStorage, workspaceId: WORKSPACE_ID });
  await identity.saveMinimalProfile({
    primaryTopics: ["software architecture", "AI systems"],
    expertise: ["software engineering"],
    interests: ["privacy-aware product systems"],
    backgroundContext: "Builds software systems and explains concrete engineering trade-offs.",
    desiredAudienceImpressions: ["careful builder who explains trade-offs"],
    qualitiesToSignal: ["thoughtful systems reasoning", "precision"],
    qualitiesToAvoid: ["hype-driven founder persona"],
    writingPrinciples: ["Explain the decision before implementation detail.", "Prefer concrete reasoning over hype."],
    dislikes: ["generic launch language", "engagement bait"],
    blockedPhrases: ["revolutionary AI platform"],
    customBoundaryRules: ["never invent customers, metrics, private repository details, or unimplemented capabilities"],
    linkedinRules: ["Use enough context to make the trade-off understandable."],
    xRules: ["Get to the engineering observation quickly."],
  });

  const signals = createBrowserContentSignalApplication({
    getStorage,
    workspaceId: WORKSPACE_ID,
    validateCanonicalReferences: false,
  });
  const signal = await signals.createManualSignal({
    headline: "Privacy changed the inference routing design",
    summary: "I changed the inference architecture so protected context cannot silently fall back to a remote provider. If a permitted route is unavailable, the system should fail closed. The useful lesson is that privacy has to be part of execution routing, not only a UI setting.",
    signalKind: "lesson",
    privacyClassification: "workspace_private",
    boundaryNote: "Do not expose private repository details, credentials, customers, metrics, or unimplemented capabilities.",
  });

  return { getStorage, signal };
}

function narrativeApplication(getStorage) {
  return createNarrativeMemoryApplication({
    narrativeMemoryRepository: createBrowserNarrativeMemoryRepository({ getStorage }),
    workspaceId: WORKSPACE_ID,
  });
}

function mapByDestination(decisions) {
  return new Map(decisions.map((item) => [item.destination, item]));
}

function countKinds(records) {
  return records.reduce((result, item) => {
    result[item.kind] = (result[item.kind] || 0) + 1;
    return result;
  }, {});
}

test("Golden Path 1 proves thought → recommendation → production → correction → exact approval → memory → reopen", async () => {
  const storage = createStorage();
  const getStorage = () => storage;
  const inferenceCalls = [];
  const fetchImpl = createInferenceFetch(inferenceCalls);
  const { signal } = await seedOwnerContext({ storage, fetchImpl });

  // 1. Owner supplies only a thought/lesson; no URL or campaign is required.
  assert.equal(signal.signalKind, "lesson");
  assert.equal(signal.sourceType, "manual");
  assert.equal(signal.workspaceId, WORKSPACE_ID);

  // 2–5. The real owner-triggered browser composition evaluates the Signal, recommends an
  // explainable angle, builds the strategy/content piece, writes LinkedIn/X, and runs critics.
  const autopilot = createBrowserGoldenPathAutopilotApplication({
    getStorage,
    workspaceId: WORKSPACE_ID,
    fetchImpl,
  });
  const prepared = await autopilot.prepareSignal(signal.signalId);
  assert.equal(prepared.status, "ready_for_judgment");
  assert.equal(prepared.nextRoute, "/today");
  assert.equal(prepared.reviewedCount, 2);

  const opportunityRepository = createBrowserContentOpportunityRepository({ getStorage });
  const [opportunity] = await opportunityRepository.list();
  assert.equal(opportunity.recommendation, "post");
  assert.ok(opportunity.whyNow.length > 20);
  assert.ok(opportunity.score >= 80);
  assert.ok(opportunity.candidateAngles.length >= 3 && opportunity.candidateAngles.length <= 5);
  assert.ok(opportunity.recommendedAngleId, "high-confidence preparation must retain its explicit recommended angle provenance");
  const recommendedAngle = opportunity.candidateAngles.find((item) => item.angleId === opportunity.recommendedAngleId);
  assert.equal(recommendedAngle?.title, "Architecture boundary");

  const planningRepository = createBrowserContentPlanningRepository({ getStorage });
  const planning = await planningRepository.list();
  const strategy = planning.find((item) => item.kind === "NarrativeStrategy");
  const piece = planning.find((item) => item.kind === "ContentPiece");
  const variants = planning.filter((item) => item.kind === "PlatformVariant");
  assert.equal(strategy.status, "approved");
  assert.equal(strategy.selectedAngle.title, "Architecture boundary");
  assert.ok(piece?.contentPieceId);
  assert.deepEqual(new Set(variants.map((item) => item.destination)), new Set(["linkedin", "x"]));

  const today = createBrowserTodayDecisionApplication({ getStorage, workspaceId: WORKSPACE_ID });
  const initialDecisions = await today.listDecisions();
  assert.equal(initialDecisions.length, 2);
  assert.ok(initialDecisions.every((item) => item.reviewVerdict === "pass"));
  const initialByDestination = mapByDestination(initialDecisions);
  const initialLinkedIn = initialByDestination.get("linkedin");
  const initialX = initialByDestination.get("x");

  // 6a. LinkedIn: owner asks naturally for a precise wording change. The existing bounded
  // change-request application creates an immutable AI-revised child and StyleMemory feedback.
  const changeApplication = createBrowserPlatformChangeRequestApplication({
    getStorage,
    workspaceId: WORKSPACE_ID,
    fetchImpl,
  });
  const changedLinkedIn = await changeApplication.requestChange(
    initialLinkedIn.platformVariantId,
    "Make the opening more direct and keep the architecture boundary precise.",
  );
  assert.equal(changedLinkedIn.origin, "ai_revised");
  assert.equal(changedLinkedIn.parentRevisionId, initialLinkedIn.platformVariantRevisionId);
  assert.match(changedLinkedIn.changeRequest, /opening more direct/i);

  // 6b. X: owner directly edits the exact draft. This exercises the non-AI correction path.
  const reviewApplication = createBrowserPlatformReviewApplication({
    getStorage,
    workspaceId: WORKSPACE_ID,
    fetchImpl,
  });
  const editedX = await reviewApplication.editCurrentVariant(initialX.platformVariantId, {
    format: "single_post",
    content: "Protected context changes the routing rule: use an allowed inference route or stop. Privacy has to be execution behavior, not a label.",
  });
  assert.equal(editedX.origin, "edited");
  assert.equal(editedX.parentRevisionId, initialX.platformVariantRevisionId);

  // Both new exact revisions must earn fresh critics. Prior reviews/approvals are historical.
  const linkedInReview = await reviewApplication.reviewRevision(initialLinkedIn.platformVariantId, changedLinkedIn.platformVariantRevisionId, {
    expectedCurrentRevisionId: changedLinkedIn.platformVariantRevisionId,
  });
  const xReview = await reviewApplication.reviewRevision(initialX.platformVariantId, editedX.platformVariantRevisionId, {
    expectedCurrentRevisionId: editedX.platformVariantRevisionId,
  });
  assert.equal(linkedInReview.overallVerdict, "pass");
  assert.equal(xReview.overallVerdict, "pass");

  // 7. Owner explicitly approves the exact visible revisions. These actions also feed
  // NarrativeMemory and eligible StyleMemory through the same browser application boundary.
  const linkedInApproval = await reviewApplication.approveRevision(initialLinkedIn.platformVariantId, changedLinkedIn.platformVariantRevisionId, {
    expectedCurrentRevisionId: changedLinkedIn.platformVariantRevisionId,
    note: "Approved after the requested wording change.",
  });
  const xApproval = await reviewApplication.approveRevision(initialX.platformVariantId, editedX.platformVariantRevisionId, {
    expectedCurrentRevisionId: editedX.platformVariantRevisionId,
    note: "Approved after my manual edit.",
  });
  assert.equal(linkedInApproval.platformVariantRevisionId, changedLinkedIn.platformVariantRevisionId);
  assert.equal(linkedInApproval.platformVariantReviewId, linkedInReview.platformVariantReviewId);
  assert.equal(xApproval.platformVariantRevisionId, editedX.platformVariantRevisionId);
  assert.equal(xApproval.platformVariantReviewId, xReview.platformVariantReviewId);
  assert.equal((await today.listDecisions()).length, 0, "Today should clear once both exact revisions are decided");

  // NarrativeMemory records what was approved internally without claiming audience exposure.
  const narrative = narrativeApplication(getStorage);
  const memories = await narrative.listMemory();
  assert.equal(memories.length, 2);
  assert.deepEqual(new Set(memories.map((item) => item.platform)), new Set(["linkedin", "x"]));
  assert.ok(memories.every((item) => item.historyStrength === "prepared_internal"));
  assert.ok(memories.every((item) => item.publishedAt === null));
  assert.deepEqual(
    new Set(memories.map((item) => item.platformVariantRevisionId)),
    new Set([changedLinkedIn.platformVariantRevisionId, editedX.platformVariantRevisionId]),
  );

  // StyleMemory sees both natural-language feedback and approved owner edits, but this isolated
  // acceptance run must not silently convert one correction into a permanent active personality rule.
  const style = createBrowserStyleMemoryApplication({ getStorage, workspaceId: WORKSPACE_ID });
  const feedback = await style.listFeedbackEvents();
  const feedbackKinds = new Set(feedback.map((item) => item.feedbackKind));
  assert.ok(feedbackKinds.has("changes_requested"));
  assert.ok(feedbackKinds.has("approved_after_edit"));
  assert.ok(feedbackKinds.has("approved_unchanged"));
  const hypotheses = await style.listHypotheses();
  assert.ok(hypotheses.length > 0, "the explicit change request / edit should create explainable candidate learning evidence");
  assert.ok(hypotheses.every((item) => item.status === "candidate"), "single isolated correction evidence must remain a candidate, not a permanent active rule");

  const beforeReopen = {
    planning: (await planningRepository.list()).length,
    opportunities: (await opportunityRepository.list()).length,
    reviews: (await createBrowserContentReviewRepository({ getStorage }).list()).length,
    narrative: memories.length,
    feedback: feedback.length,
    hypotheses: hypotheses.length,
  };

  // 8. Simulate browser/application recreation against the same persisted storage.
  const reopenedToday = createBrowserTodayDecisionApplication({ getStorage, workspaceId: WORKSPACE_ID });
  const reopenedReview = createBrowserPlatformReviewApplication({ getStorage, workspaceId: WORKSPACE_ID, fetchImpl });
  const reopenedNarrative = narrativeApplication(getStorage);
  const reopenedStyle = createBrowserStyleMemoryApplication({ getStorage, workspaceId: WORKSPACE_ID });
  const reopenedPlanning = createBrowserContentPlanningRepository({ getStorage });
  const reopenedOpportunity = createBrowserContentOpportunityRepository({ getStorage });
  const reopenedReviewRepository = createBrowserContentReviewRepository({ getStorage });

  assert.equal((await reopenedToday.listDecisions()).length, 0);
  const reopenedLinkedInBundle = await reopenedReview.getReviewBundle(initialLinkedIn.platformVariantId);
  const reopenedXBundle = await reopenedReview.getReviewBundle(initialX.platformVariantId);
  assert.equal(reopenedLinkedInBundle.revision.platformVariantRevisionId, changedLinkedIn.platformVariantRevisionId);
  assert.equal(reopenedLinkedInBundle.approvalValid, true);
  assert.equal(reopenedXBundle.revision.platformVariantRevisionId, editedX.platformVariantRevisionId);
  assert.equal(reopenedXBundle.approvalValid, true);

  const linkedInHistory = await reopenedReview.getRevisionHistory(initialLinkedIn.platformVariantId);
  const xHistory = await reopenedReview.getRevisionHistory(initialX.platformVariantId);
  assert.equal(linkedInHistory.length, 2);
  assert.equal(xHistory.length, 2);
  assert.ok(linkedInHistory.some((item) => item.revision.platformVariantRevisionId === initialLinkedIn.platformVariantRevisionId));
  assert.ok(xHistory.some((item) => item.revision.platformVariantRevisionId === initialX.platformVariantRevisionId));

  const reopenedMemories = await reopenedNarrative.listMemory();
  const reopenedFeedback = await reopenedStyle.listFeedbackEvents();
  const reopenedHypotheses = await reopenedStyle.listHypotheses();
  assert.equal(reopenedMemories.length, 2);
  assert.ok(reopenedMemories.every((item) => item.historyStrength === "prepared_internal" && item.publishedAt === null));

  const afterReopen = {
    planning: (await reopenedPlanning.list()).length,
    opportunities: (await reopenedOpportunity.list()).length,
    reviews: (await reopenedReviewRepository.list()).length,
    narrative: reopenedMemories.length,
    feedback: reopenedFeedback.length,
    hypotheses: reopenedHypotheses.length,
  };
  assert.deepEqual(afterReopen, beforeReopen, "reopen must preserve canonical state without duplicating records");

  // Sanitized acceptance evidence: concrete enough to audit without copying private source data.
  const acceptanceEvidence = {
    entry: "manual ContentSignal",
    opportunity: {
      recommendation: opportunity.recommendation,
      score: opportunity.score,
      angleCount: opportunity.candidateAngles.length,
      recommendedAngle: recommendedAngle.title,
    },
    strategy: { status: strategy.status, selectedAngle: strategy.selectedAngle.title },
    destinations: [...new Set(variants.map((item) => item.destination))].sort(),
    corrections: ["linkedin:natural_language_change", "x:owner_edit"],
    exactApprovals: [linkedInApproval.platformVariantRevisionId, xApproval.platformVariantRevisionId].sort(),
    narrativeMemory: memories.map((item) => ({ platform: item.platform, historyStrength: item.historyStrength, publishedAt: item.publishedAt })),
    reopened: true,
  };

  assert.deepEqual(acceptanceEvidence.destinations, ["linkedin", "x"]);
  assert.equal(acceptanceEvidence.opportunity.angleCount, 4);
  assert.equal(acceptanceEvidence.narrativeMemory.every((item) => item.historyStrength === "prepared_internal" && item.publishedAt === null), true);
  assert.equal(acceptanceEvidence.reopened, true);

  // The acceptance path intentionally uses the deterministic test inference transport while exercising
  // the same browser-local application/domain/repository composition used by the product.
  assert.ok(inferenceCalls.some((call) => call.taskType === "platform_variant_revision"));
  assert.equal(countKinds(await reopenedPlanning.list()).PlatformVariantRevision, 4);
});
