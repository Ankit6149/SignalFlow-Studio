import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  CAMPAIGN_STATE_SCHEMA_VERSION,
  createGenerationRun,
  createGenerationSourceSnapshot,
  getCampaignFreshness,
  getGenerationSourceChanges,
  restoreGenerationRun,
} from "../lib/studio/campaignFreshness.mjs";

function baseInput() {
  return {
    form: {
      projectName: "SignalFlow launch",
      notes: "A factual product brief.",
      audience: "Founders and builders",
      links: "https://example.com/docs",
      repo: "https://github.com/example/signalflow",
      provider: "gemini",
      apiKey: "temporary-secret",
      model: "gemini-2.5-flash",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/",
    },
    channels: ["linkedin", "x"],
    files: [
      {
        name: "brief.md",
        type: "text/markdown",
        size: 42,
        extracted: true,
        description: "Text content extracted in the browser.",
      },
    ],
    documentText: ["FILE: brief.md\nEvidence"],
  };
}

function fingerprint(input = baseInput()) {
  return createGenerationSourceSnapshot(input, { createdAt: null }).fingerprint;
}

const changes = [
  ["campaign name", (input) => { input.form.projectName = "A different launch"; }],
  ["brief", (input) => { input.form.notes = "A changed product brief."; }],
  ["audience", (input) => { input.form.audience = "Developer teams"; }],
  ["links", (input) => { input.form.links = "https://example.com/new-docs"; }],
  ["repository", (input) => { input.form.repo = "https://github.com/example/other"; }],
  ["destinations", (input) => { input.channels.push("reddit"); }],
  ["provider", (input) => { input.form.provider = "openai"; }],
  ["model", (input) => { input.form.model = "gpt-5"; }],
  ["endpoint", (input) => { input.form.baseUrl = "https://gateway.example/v1"; }],
  ["document text", (input) => { input.documentText[0] += "\nNew evidence"; }],
  ["attached files", (input) => { input.files[0].description = "Updated reference"; }],
];

for (const [label, mutate] of changes) {
  test(`${label} changes invalidate the generation fingerprint`, () => {
    const input = baseInput();
    const original = fingerprint(input);
    mutate(input);
    assert.notEqual(fingerprint(input), original);
  });
}

test("temporary API key changes do not invalidate generated content", () => {
  const input = baseInput();
  const original = fingerprint(input);
  input.form.apiKey = "a-different-temporary-secret";
  assert.equal(fingerprint(input), original);
});

test("normalization keeps equivalent whitespace, line endings, destination order, and trailing slashes stable", () => {
  const original = baseInput();
  const equivalent = baseInput();
  equivalent.form.notes = "  A factual product brief.\r\n";
  equivalent.form.baseUrl = "https://generativelanguage.googleapis.com/v1beta";
  equivalent.channels = ["x", "linkedin", "linkedin"];
  equivalent.documentText = ["  FILE: brief.md\r\nEvidence  "];
  assert.equal(fingerprint(equivalent), fingerprint(original));
});

test("freshness blocks untracked and changed generations but accepts the matching snapshot", () => {
  const sourceSnapshot = createGenerationSourceSnapshot(baseInput(), { createdAt: "2026-07-27T00:00:00.000Z" });
  const generationRun = createGenerationRun({
    sourceSnapshot,
    provider: "gemini",
    model: "gemini-2.5-flash",
    createdAt: "2026-07-27T00:00:01.000Z",
  });

  assert.deepEqual(
    getCampaignFreshness({ hasResult: true, currentSourceFingerprint: sourceSnapshot.fingerprint, generationRun }),
    { status: "current", isStale: false, canUseCurrentGeneration: true },
  );
  assert.deepEqual(
    getCampaignFreshness({ hasResult: true, currentSourceFingerprint: "sf1-changed", generationRun }),
    { status: "stale", isStale: true, canUseCurrentGeneration: false },
  );
  assert.deepEqual(
    getCampaignFreshness({ hasResult: true, currentSourceFingerprint: sourceSnapshot.fingerprint, generationRun: null }),
    { status: "untracked", isStale: true, canUseCurrentGeneration: false },
  );
});

test("generation run and source snapshot survive save and reopen deterministically", () => {
  const input = baseInput();
  const sourceSnapshot = createGenerationSourceSnapshot(input, { createdAt: "2026-07-27T00:00:00.000Z" });
  const generationRun = createGenerationRun({
    sourceSnapshot,
    response: { request_id: "request-123", providerUsed: "gemini", modelUsed: "gemini-2.5-flash" },
    createdAt: "2026-07-27T00:00:01.000Z",
  });
  const saved = JSON.parse(JSON.stringify({ generationRun }));
  const restored = restoreGenerationRun(saved);

  assert.equal(restored.schemaVersion, CAMPAIGN_STATE_SCHEMA_VERSION);
  assert.equal(restored.generationRunId, "request-123");
  assert.equal(restored.sourceFingerprint, sourceSnapshot.fingerprint);
  assert.equal(fingerprint(input), restored.sourceFingerprint);
  assert.equal(
    getCampaignFreshness({
      hasResult: true,
      currentSourceFingerprint: fingerprint(input),
      generationRun: restored,
    }).status,
    "current",
  );
});

test("legacy saved campaigns receive a deterministic generation run without persisting an API key", () => {
  const input = baseInput();
  const restored = restoreGenerationRun({
    id: "campaign-legacy",
    updatedAt: "2026-07-27T00:00:00.000Z",
    brief: { ...input.form, apiKey: "" },
    channels: input.channels,
    sourceFiles: input.files,
    documentText: input.documentText,
    posts: { linkedin: "Legacy post" },
    result: { providerUsed: "gemini" },
  });

  assert.equal(restored.generationRunId, "legacy-campaign-legacy");
  assert.equal(restored.sourceFingerprint, fingerprint(input));
  assert.equal(JSON.stringify(restored).includes("temporary-secret"), false);
});

test("source change descriptions name only the changed generation inputs", () => {
  const previous = createGenerationSourceSnapshot(baseInput(), { createdAt: null });
  const changed = baseInput();
  changed.form.notes = "Changed brief";
  changed.form.model = "another-model";
  changed.channels.push("reddit");
  const current = createGenerationSourceSnapshot(changed, { createdAt: null });

  assert.deepEqual(getGenerationSourceChanges(previous, current), ["brief", "destinations", "model"]);
});

test("Studio renders a persistent stale warning and blocks outbound actions", async () => {
  const page = await readFile(new URL("../app/page.js", import.meta.url), "utf8");
  const layout = await readFile(new URL("../app/layout.js", import.meta.url), "utf8");

  assert.match(page, /className="campaign-stale-banner"/);
  assert.match(page, /role="alert"/);
  assert.match(page, /data-freshness=\{campaignFreshness\.status\}/);
  assert.match(page, /disabled=\{isCampaignStale \|\| !currentPost\}/);
  assert.match(page, /disabled=\{isCampaignStale\}/);
  assert.match(page, /generationRun,/);
  assert.match(layout, /campaign-freshness\.css/);
});
