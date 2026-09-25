import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  MEDIA_SOURCE_CATEGORIES,
  normalizeMediaSourceCategory,
} from "../lib/domain/sourceArtifacts.mjs";
import {
  STRATEGY_QUALITY_STATES,
  evaluateStrategyQuality,
} from "../lib/ai/strategyQuality.mjs";
import {
  assessCrossChannelDuplicates,
  duplicateRevisionTargets,
} from "../lib/ai/crossChannelQuality.mjs";
import {
  mapWithConcurrency,
  mapDestinationsWithPolicy,
  resolveDestinationConcurrency,
} from "../lib/ai/generationConcurrency.mjs";
import { createLinkedAbort } from "../lib/ai/requestAbort.mjs";
import {
  PROVIDER_ERROR_CODES,
  malformedProviderResponse,
  normalizeProviderError,
  providerErrorPayload,
} from "../lib/ai/providerErrors.mjs";
import {
  campaignReducer,
  createInitialCampaignState,
} from "../lib/studio/campaignState.mjs";
import {
  REGENERATION_POLICIES,
  regenerationTargets,
} from "../lib/studio/regenerationPolicy.mjs";

function validStrategyFixture() {
  const context = {
    confirmedFacts: [
      "SignalFlow keeps review before publishing.",
      "SignalFlow creates destination-specific drafts from product evidence.",
    ],
    inferredFacts: [],
    missingContext: [],
    features: ["Review before publishing", "Destination-specific drafts"],
    techStack: ["Next.js"],
    repoInsights: [],
    docsInsights: [],
    linkInsights: [],
  };
  return {
    rawBrief: {
      project: { name: "SignalFlow Studio" },
      context,
      strategy: {},
    },
    package: {
      project: { name: "SignalFlow Studio" },
      context,
      strategy: {
        coreAngle: "Product evidence should remain connected to editorial decisions.",
        positioning: "Review-first campaign creation grounded in product evidence.",
        proofPoints: ["SignalFlow keeps review before publishing."],
        safeClaims: ["SignalFlow creates destination-specific drafts from product evidence."],
        avoidClaims: ["Do not claim unsupported automation or performance metrics."],
        destinationAngles: {
          linkedin: "Explain the decision and trade-off.",
          x: "Lead with the concise product insight.",
        },
      },
    },
    selectedChannels: ["linkedin", "x"],
    sourceContext: context,
  };
}

test("media MIME and descriptors normalize into one semantic vocabulary", () => {
  assert.equal(
    normalizeMediaSourceCategory({ sourceKind: "screenshot", mimeType: "image/png" }),
    MEDIA_SOURCE_CATEGORIES.SCREENSHOT,
  );
  assert.equal(
    normalizeMediaSourceCategory({ mimeType: "image/png", originalName: "dashboard-screenshot.png" }),
    MEDIA_SOURCE_CATEGORIES.SCREENSHOT,
  );
  assert.equal(
    normalizeMediaSourceCategory({ mimeType: "image/webp", description: "Product UI hero" }),
    MEDIA_SOURCE_CATEGORIES.PRODUCT_IMAGE,
  );
  assert.equal(
    normalizeMediaSourceCategory({ mimeType: "video/webm", originalName: "feature-screen-recording.webm" }),
    MEDIA_SOURCE_CATEGORIES.SCREEN_RECORDING,
  );
  assert.equal(
    normalizeMediaSourceCategory({ mimeType: "video/mp4", originalName: "camera-demo.mp4" }),
    MEDIA_SOURCE_CATEGORIES.VIDEO,
  );
  assert.equal(
    normalizeMediaSourceCategory({ mimeType: "application/pdf", assetType: "document" }),
    MEDIA_SOURCE_CATEGORIES.DOCUMENT,
  );
  assert.equal(
    normalizeMediaSourceCategory({ mimeType: "application/octet-stream" }),
    MEDIA_SOURCE_CATEGORIES.OTHER,
  );
});

test("workspace context consumes semantic visual categories instead of raw MIME-only assumptions", async () => {
  const source = await readFile(new URL("../lib/context/documentContext.js", import.meta.url), "utf8");
  assert.match(source, /item\?\.category \|\| item\?\.type/);
  assert.match(source, /"screenshot", "product image", "screen recording", "image", "video"/);
  assert.match(source, /Screenshots, product images, or demo recordings are missing/);
});

test("strategy quality distinguishes complete, needs_review, and failed with stable issue codes", () => {
  const complete = evaluateStrategyQuality(validStrategyFixture());
  assert.equal(complete.status, STRATEGY_QUALITY_STATES.COMPLETE);
  assert.deepEqual(complete.issueCodes, []);

  const unsupported = validStrategyFixture();
  unsupported.package.strategy.safeClaims = ["SignalFlow reduces review time by 42%."];
  const needsReview = evaluateStrategyQuality(unsupported);
  assert.equal(needsReview.status, STRATEGY_QUALITY_STATES.NEEDS_REVIEW);
  assert.ok(needsReview.issueCodes.includes("strategy.unsupported_quantitative_claim"));

  const failed = evaluateStrategyQuality({
    rawBrief: { project: {}, context: {}, strategy: {} },
    package: { project: {}, context: {}, strategy: {} },
    selectedChannels: ["linkedin"],
    sourceContext: {},
  });
  assert.equal(failed.status, STRATEGY_QUALITY_STATES.FAILED);
  assert.ok(failed.issueCodes.includes("strategy.project_missing"));
  assert.ok(failed.issueCodes.includes("strategy.core_angle_missing"));
  assert.ok(failed.issueCodes.includes("strategy.destination_angle_missing"));
});

test("strategy gate occurs before any destination generation lane starts", async () => {
  const source = await readFile(new URL("../lib/ai/generateStudioPackage.js", import.meta.url), "utf8");
  const gate = source.indexOf("strategyQuality.status !== STRATEGY_QUALITY_STATES.COMPLETE");
  const destinationStart = source.indexOf("mapWithConcurrency(channels");
  assert.ok(gate >= 0, "strategy quality gate must exist");
  assert.ok(destinationStart >= 0, "destination orchestration must exist");
  assert.ok(gate < destinationStart, "strategy must be accepted before destination calls begin");
  assert.match(source, /code: "strategy_quality_blocked"/);
});

test("cross-channel duplicate scoring is deterministic and targets only requested weak destinations", () => {
  const shared = {
    body: "SignalFlow starts with product evidence, keeps review before publishing, and turns the same product evidence into a destination specific draft with review before publishing.",
  };
  const reportsA = assessCrossChannelDuplicates({ linkedin: shared, x: shared });
  const reportsB = assessCrossChannelDuplicates({ linkedin: shared, x: shared });
  assert.deepEqual(reportsA, reportsB);
  assert.equal(reportsA.length, 1);
  assert.equal(reportsA[0].excessive, true);
  assert.ok(reportsA[0].score >= 0.42);

  const targets = duplicateRevisionTargets({
    generatedDrafts: { x: shared },
    comparisonDrafts: { linkedin: shared },
    requestedChannels: ["x"],
  });
  assert.equal(targets.length, 1);
  assert.equal(targets[0].channel, "x");
  assert.equal(targets[0].duplicateWith, "linkedin");
  assert.equal(targets[0].issueCode, "cross_channel_duplicate");
  assert.match(targets[0].guidance, /change the opening, structure, and CTA/i);

  const distinct = assessCrossChannelDuplicates({
    linkedin: { body: "A release decision was delayed because evidence was incomplete. The team documented the trade-off and kept review explicit." },
    x: { body: "Local inference routing starts by classifying data boundaries, then chooses an allowed model endpoint for the request." },
  });
  assert.ok(distinct.every((report) => report.excessive === false));
});

test("duplicate repair is rechecked and unresolved overlap remains needs_review", async () => {
  const source = await readFile(new URL("../lib/ai/generateStudioPackage.js", import.meta.url), "utf8");
  assert.match(source, /const unresolvedDuplicateTargets = duplicateRevisionTargets/);
  assert.match(source, /unresolvedDuplicateRevisionTargets: unresolvedDuplicateTargets/);
  assert.match(source, /issueCodes: Array\.from\(new Set\(\[\.\.\.\(item\.status\.issueCodes \|\| \[\]\), "cross_channel_duplicate"\]\)\)/);
  assert.match(source, /qualityStatus: "needs_review"/);
});

test("destination concurrency stays bounded and preserves input ordering", async () => {
  let active = 0;
  let peak = 0;
  const result = await mapWithConcurrency([1, 2, 3, 4, 5], async (value) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return value * 10;
  }, 2);

  assert.ok(peak <= 2, `peak concurrency was ${peak}`);
  assert.deepEqual(result, [10, 20, 30, 40, 50]);
});

test("destination queue stops starting new work after cancellation", async () => {
  const controller = new AbortController();
  const started = [];
  await mapWithConcurrency([1, 2, 3, 4, 5, 6], async (value) => {
    started.push(value);
    if (value === 1) controller.abort();
    await new Promise((resolve) => setTimeout(resolve, 5));
    return value;
  }, 2, { signal: controller.signal });

  assert.ok(started.length <= 2, `started ${started.length} tasks after cancellation`);
  assert.ok(started.includes(1));
});

test("linked provider abort distinguishes caller cancellation from timeout", async () => {
  const controller = new AbortController();
  const linked = createLinkedAbort({ signal: controller.signal, timeoutMs: 5_000 });
  controller.abort();
  await Promise.resolve();
  assert.equal(linked.signal.aborted, true);
  assert.equal(linked.cancelled(), true);
  assert.equal(linked.timedOut(), false);
  linked.cleanup();
});

test("provider failures normalize into safe actionable recovery contracts", () => {
  const cases = [
    [{ status: 401, message: "invalid api key sk-secret" }, PROVIDER_ERROR_CODES.INVALID_CREDENTIALS, false, "replace_key"],
    [{ status: 403, message: "forbidden" }, PROVIDER_ERROR_CODES.AUTHORIZATION, false, "check_permissions"],
    [{ status: 404, message: "model not found" }, PROVIDER_ERROR_CODES.MODEL_NOT_FOUND, false, "choose_model"],
    [{ status: 429, message: "too many requests" }, PROVIDER_ERROR_CODES.RATE_LIMITED, false, "wait_then_retry"],
    [{ status: 429, message: "insufficient_quota" }, PROVIDER_ERROR_CODES.QUOTA_EXCEEDED, false, "check_quota"],
    [{ status: 402, message: "payment required" }, PROVIDER_ERROR_CODES.PAYMENT_REQUIRED, false, "check_billing"],
    [{ name: "AbortError", message: "request timed out" }, PROVIDER_ERROR_CODES.TIMEOUT, true, "retry_destination"],
    [{ status: 503, message: "provider body with private prompt text" }, PROVIDER_ERROR_CODES.UNAVAILABLE, true, "retry_destination"],
  ];

  for (const [input, code, retryable, action] of cases) {
    const error = normalizeProviderError(input, { provider: "test-provider", model: "test-model" });
    const payload = providerErrorPayload(error);
    assert.equal(payload.code, code);
    assert.equal(payload.retryable, retryable);
    assert.equal(payload.recoveryAction, action);
    assert.equal(payload.provider, "test-provider");
    assert.equal(payload.model, "test-model");
    assert.match(payload.correlationId, /^provider-/);
    assert.doesNotMatch(payload.message, /sk-secret|private prompt text/i);
  }

  const malformed = providerErrorPayload(malformedProviderResponse({ provider: "test-provider", model: "broken-model" }));
  assert.equal(malformed.code, PROVIDER_ERROR_CODES.MALFORMED_RESPONSE);
  assert.equal(malformed.retryable, false);
  assert.equal(malformed.recoveryAction, "retry_or_choose_model");
});

test("API and MCP preserve the same safe provider error structure", async () => {
  const route = await readFile(new URL("../app/api/launch_kit/route.js", import.meta.url), "utf8");
  const httpClient = await readFile(new URL("../../mcp/lib/httpClient.mjs", import.meta.url), "utf8");
  const tools = await readFile(new URL("../../mcp/lib/tools.mjs", import.meta.url), "utf8");

  assert.match(route, /providerErrorPayload\(error\)/);
  assert.match(route, /providerError,/);
  assert.match(httpClient, /signalFlowData/);
  assert.match(tools, /structuredContent: structured/);
  assert.match(tools, /structured\.providerError\?\.message/);
});

function needsReviewState() {
  return campaignReducer(createInitialCampaignState(), {
    type: "ACCEPT_GENERATION",
    payload: {
      posts: { linkedin: "Draft that still needs review." },
      requestedChannels: ["linkedin"],
      result: {
        generation_status: {
          linkedin: {
            status: "needs_review",
            qualityStatus: "needs_review",
            issues: ["The draft still overlaps another destination."],
            issueCodes: ["cross_channel_duplicate"],
            retryCount: 1,
            providerError: {
              code: "provider_rate_limited",
              message: "Provider is rate-limiting requests.",
              retryable: false,
              recoveryAction: "wait_then_retry",
              correlationId: "provider-test",
            },
          },
        },
      },
      generationRun: { generationRunId: "run-quality-1" },
      activeChannel: "linkedin",
    },
  });
}

test("needs_review is persisted separately and requires explicit risk acceptance before approval", () => {
  let state = needsReviewState();
  assert.equal(state.channelStates.linkedin.status, "needs_review");
  assert.equal(state.channelStates.linkedin.qualityStatus, "needs_review");
  assert.equal(state.channelStates.linkedin.approved, false);
  assert.deepEqual(state.channelStates.linkedin.issueCodes, ["cross_channel_duplicate"]);

  state = campaignReducer(state, { type: "MARK_CHANNEL_APPROVED", channel: "linkedin" });
  assert.equal(state.channelStates.linkedin.approved, false);
  assert.equal(state.channelStates.linkedin.qualityRiskAccepted, false);

  state = campaignReducer(state, {
    type: "MARK_CHANNEL_APPROVED",
    channel: "linkedin",
    acceptRisk: true,
  });
  assert.equal(state.channelStates.linkedin.approved, true);
  assert.equal(state.channelStates.linkedin.qualityRiskAccepted, true);

  const reopened = JSON.parse(JSON.stringify(state));
  assert.equal(reopened.channelStates.linkedin.qualityStatus, "needs_review");
  assert.deepEqual(reopened.channelStates.linkedin.issues, ["The draft still overlaps another destination."]);
  assert.equal(reopened.channelStates.linkedin.providerError.code, "provider_rate_limited");

  const edited = campaignReducer(reopened, {
    type: "EDIT_POST",
    channel: "linkedin",
    text: "Owner edited this draft after accepting the risk.",
  });
  assert.equal(edited.channelStates.linkedin.qualityStatus, "needs_review");
  assert.equal(edited.channelStates.linkedin.approved, false);
  assert.equal(edited.channelStates.linkedin.qualityRiskAccepted, false);
  assert.deepEqual(edited.channelStates.linkedin.issueCodes, ["cross_channel_duplicate"]);
});

test("complete, needs_review, and failed quality states remain behaviorally distinct", () => {
  const complete = campaignReducer(createInitialCampaignState(), {
    type: "ACCEPT_GENERATION",
    payload: {
      posts: { x: "A complete reviewed-quality draft." },
      requestedChannels: ["x"],
      result: { generation_status: { x: { status: "generated", qualityStatus: "complete", issues: [] } } },
      generationRun: { generationRunId: "run-complete" },
      activeChannel: "x",
    },
  });
  assert.equal(complete.channelStates.x.qualityStatus, "complete");

  const review = needsReviewState();
  assert.equal(review.channelStates.linkedin.qualityStatus, "needs_review");

  const failed = campaignReducer(createInitialCampaignState(), {
    type: "ACCEPT_GENERATION",
    payload: {
      posts: {},
      requestedChannels: ["reddit"],
      result: {
        generation_status: {
          reddit: {
            status: "failed",
            qualityStatus: "failed",
            issues: ["Provider request failed."],
            issueCodes: ["provider_unavailable"],
          },
        },
      },
      generationRun: { generationRunId: "run-failed" },
      activeChannel: "reddit",
    },
  });
  assert.equal(failed.channelStates.reddit.qualityStatus, "failed");
  assert.equal(failed.channelStates.reddit.approved, false);
});


test("failed destinations expose an isolated retry path without touching successful channels", async () => {
  const page = await readFile(new URL("../app/page.js", import.meta.url), "utf8");
  assert.match(page, /\? "Generation failed"/);
  assert.match(page, /\? "Retry destination" : "Regenerate this channel"/);
  assert.match(page, /\["needs_review", "failed", "cancelled"\]\.includes\(channelStates\[activeChannel\]\?\.status\) \? "alert" : "status"/);

  const targets = regenerationTargets({
    policy: REGENERATION_POLICIES.CHANNEL,
    channels: ["linkedin", "x", "reddit"],
    channelStates: {
      linkedin: { status: "complete" },
      x: { status: "failed" },
      reddit: { status: "needs_review" },
    },
    activeChannel: "x",
  });
  assert.deepEqual(targets, ["x"]);
});


test("generation cancellation is propagated through API, providers, UI, and campaign state", async () => {
  const routeSource = await readFile(new URL("../app/api/launch_kit/route.js", import.meta.url), "utf8");
  const packageSource = await readFile(new URL("../lib/ai/generateStudioPackage.js", import.meta.url), "utf8");
  const pageSource = await readFile(new URL("../app/page.js", import.meta.url), "utf8");
  const providerPaths = [
    "../lib/ai/providers/openai.js",
    "../lib/ai/providers/claude.js",
    "../lib/ai/providers/gemini.js",
    "../lib/ai/providers/groq.js",
    "../lib/ai/providers/openrouter.js",
    "../lib/ai/providers/customOpenAI.js",
    "../lib/ai/providers/ollama.js",
    "../lib/ai/providers/lmstudio.js",
    "../lib/ai/providers/vercelGateway.js",
  ];

  assert.match(routeSource, /signal: request\.signal/);
  assert.match(packageSource, /\{ signal: executionConfig\.signal \}/);
  assert.match(pageSource, /Cancel generation/);
  assert.match(pageSource, /MARK_CHANNELS_CANCELLED/);

  for (const providerPath of providerPaths) {
    const providerSource = await readFile(new URL(providerPath, import.meta.url), "utf8");
    assert.match(providerSource, /createLinkedAbort/);
    assert.match(providerSource, /abort\.cancelled\(\)/);
  }

  let state = campaignReducer(createInitialCampaignState(), {
    type: "ACCEPT_GENERATION",
    payload: {
      posts: { linkedin: "Existing draft" },
      requestedChannels: ["linkedin"],
      result: { generation_status: { linkedin: { status: "generated", qualityStatus: "complete" } } },
      generationRun: { generationRunId: "run-before-cancel" },
      activeChannel: "linkedin",
    },
  });
  state = campaignReducer(state, { type: "MARK_CHANNELS_CANCELLED", channels: ["linkedin"] });
  assert.equal(state.posts.linkedin, "Existing draft");
  assert.equal(state.channelStates.linkedin.status, "cancelled");
  assert.equal(state.channelStates.linkedin.qualityStatus, "needs_review");
  assert.equal(state.channelStates.linkedin.approved, false);
  assert.ok(state.channelStates.linkedin.issueCodes.includes("generation_cancelled"));
});

test("provider cancellation keeps a distinct safe error class", () => {
  const error = new Error("cancelled");
  error.name = "AbortError";
  error.code = "provider_request_cancelled";
  error.status = 499;
  const normalized = providerErrorPayload(normalizeProviderError(error, {
    provider: "test-provider",
    model: "test-model",
  }));
  assert.equal(normalized.code, PROVIDER_ERROR_CODES.CANCELLED);
  assert.equal(normalized.retryable, true);
  assert.equal(normalized.recoveryAction, "retry_destination");
  assert.equal(normalized.httpStatus, 499);
});


test("destination scheduling respects provider ceilings and isolates long-form work", async () => {
  assert.equal(resolveDestinationConcurrency({ isLocalProvider: false }), 2);
  assert.equal(resolveDestinationConcurrency({ isLocalProvider: false, configuredConcurrency: 1 }), 1);
  assert.equal(resolveDestinationConcurrency({ isLocalProvider: false, configuredConcurrency: 9 }), 2);
  assert.equal(resolveDestinationConcurrency({ isLocalProvider: true }), 1);
  assert.equal(resolveDestinationConcurrency({ isLocalProvider: true, configuredConcurrency: 4 }), 1);

  const active = new Set();
  let peak = 0;
  const starts = [];
  const result = await mapDestinationsWithPolicy(
    ["linkedin", "x", "blog", "newsletter"],
    async (channel) => {
      active.add(channel);
      peak = Math.max(peak, active.size);
      starts.push({ channel, active: [...active] });
      await new Promise((resolve) => setTimeout(resolve, 5));
      active.delete(channel);
      return channel.toUpperCase();
    },
    { isLocalProvider: false },
  );

  assert.ok(peak <= 2, `hosted peak concurrency was ${peak}`);
  const firstLongForm = starts.findIndex((item) => ["blog", "newsletter"].includes(item.channel));
  assert.ok(firstLongForm >= 0);
  assert.ok(
    starts.slice(0, firstLongForm).every((item) => !["blog", "newsletter"].includes(item.channel)),
    "long-form work should start only after the short-form phase completes",
  );
  assert.deepEqual(result, ["LINKEDIN", "X", "BLOG", "NEWSLETTER"]);
});

test("local provider destination scheduling stays sequential", async () => {
  let active = 0;
  let peak = 0;
  await mapDestinationsWithPolicy(
    ["linkedin", "x", "blog"],
    async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 3));
      active -= 1;
    },
    { isLocalProvider: true, configuredConcurrency: 4 },
  );
  assert.equal(peak, 1);
});

test("orchestration uses the provider-aware lane policy for initial and duplicate repair work", async () => {
  const source = await readFile(new URL("../lib/ai/generateStudioPackage.js", import.meta.url), "utf8");
  assert.match(source, /mapDestinationsWithPolicy\(channels/);
  assert.match(source, /isLocalProvider: localProvider/);
  assert.match(source, /mapDestinationsWithPolicy\(duplicateTargets/);
  assert.match(source, /channelOf: \(target\) => target\.channel/);
});
