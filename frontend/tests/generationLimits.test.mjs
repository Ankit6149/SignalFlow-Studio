import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { GENERATION_LIMITS } from "../lib/package/generationLimits.mjs";
import { validateGenerationInputs } from "../lib/package/validatePackage.js";
import { readGenerationRequestBody } from "../lib/server/generationRequestBody.mjs";

function issueCodes(result) {
  return new Set((result.limitIssues || []).map((issue) => issue.code));
}

test("generation body reader rejects declared oversized payload before JSON parsing", async () => {
  const request = new Request("https://signalflow.test/api/launch_kit", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "content-length": String(GENERATION_LIMITS.requestBytes + 1),
    },
    body: "{}",
  });
  const result = await readGenerationRequestBody(request);
  assert.equal(result.ok, false);
  assert.equal(result.status, 413);
  assert.equal(result.code, "generation_limit_exceeded");
  assert.equal(result.issues[0].code, "generation_limit.request_bytes");
  assert.equal(result.issues[0].actual, GENERATION_LIMITS.requestBytes + 1);
});

test("generation body reader rejects actual oversized payload and malformed JSON", async () => {
  const oversized = new Request("https://signalflow.test/api/launch_kit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ notes: "x".repeat(GENERATION_LIMITS.requestBytes + 1) }),
  });
  const oversizedResult = await readGenerationRequestBody(oversized);
  assert.equal(oversizedResult.status, 413);
  assert.equal(oversizedResult.issues[0].code, "generation_limit.request_bytes");

  const malformed = new Request("https://signalflow.test/api/launch_kit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{not-json",
  });
  const malformedResult = await readGenerationRequestBody(malformed);
  assert.equal(malformedResult.ok, false);
  assert.equal(malformedResult.status, 400);
  assert.equal(malformedResult.code, "invalid_json");
});

test("generation validation returns stable field-specific limit codes", () => {
  const cases = [
    [
      { notes: "x".repeat(GENERATION_LIMITS.notesChars + 1) },
      "generation_limit.notes_chars",
    ],
    [
      { notes: "ok", docs_url: Array.from({ length: GENERATION_LIMITS.linksCount + 1 }, (_, index) => `https://example.com/${index}`).join(" ") },
      "generation_limit.links_count",
    ],
    [
      { notes: "ok", document_text: Array.from({ length: GENERATION_LIMITS.documentItems + 1 }, () => "doc") },
      "generation_limit.document_items",
    ],
    [
      { notes: "ok", document_text: ["x".repeat(GENERATION_LIMITS.documentChars + 1)] },
      "generation_limit.document_chars",
    ],
    [
      { notes: "ok", channels: Array.from({ length: GENERATION_LIMITS.channels + 1 }, (_, index) => `channel-${index}`) },
      "generation_limit.channels",
    ],
    [
      { notes: "ok", assets: Array.from({ length: GENERATION_LIMITS.sourceRecordsPerKind + 1 }, () => ({})) },
      "generation_limit.assets",
    ],
    [
      { notes: "ok", source_artifacts: Array.from({ length: GENERATION_LIMITS.sourceRecordsPerKind + 1 }, () => ({})) },
      "generation_limit.source_artifacts",
    ],
    [
      { notes: "ok", processing_records: Array.from({ length: GENERATION_LIMITS.sourceRecordsPerKind + 1 }, () => ({})) },
      "generation_limit.processing_records",
    ],
    [
      { notes: "ok", media_items: Array.from({ length: GENERATION_LIMITS.mediaItems + 1 }, () => ({})) },
      "generation_limit.media_items",
    ],
  ];

  for (const [body, expectedCode] of cases) {
    const result = validateGenerationInputs(body);
    assert.equal(result.valid, false, expectedCode);
    assert.ok(issueCodes(result).has(expectedCode), `missing ${expectedCode}`);
  }
});

test("combined text context has its own budget", () => {
  const body = {
    notes: "n".repeat(35_000),
    audience: "a".repeat(3_000),
    docs_url: "https://example.com/" + "l".repeat(4_000),
    document_text: ["d".repeat(119_000)],
  };
  const result = validateGenerationInputs(body);
  assert.ok(issueCodes(result).has("generation_limit.total_text_context_chars"));
  assert.equal(issueCodes(result).has("generation_limit.notes_chars"), false);
  assert.equal(issueCodes(result).has("generation_limit.document_chars"), false);
});

test("exact individual generation limits remain accepted", () => {
  const result = validateGenerationInputs({
    notes: "n".repeat(GENERATION_LIMITS.notesChars),
    channels: Array.from({ length: GENERATION_LIMITS.channels }, (_, index) => `channel-${index}`),
    document_text: Array.from({ length: GENERATION_LIMITS.documentItems }, () => "doc"),
  });
  assert.equal(result.limitIssues.length, 0);
});

test("launch kit applies body and field limits before provider generation", async () => {
  const route = await readFile(new URL("../app/api/launch_kit/route.js", import.meta.url), "utf8");
  const readIndex = route.indexOf("readGenerationRequestBody(request)");
  const validateIndex = route.indexOf("validateGenerationInputs(body)");
  const streamedGenerationIndex = route.indexOf("return streamGeneration({", validateIndex);
  const jsonGenerationIndex = route.indexOf("const result = await generateStudioPackage({", validateIndex);
  assert.ok(readIndex >= 0);
  assert.ok(validateIndex > readIndex);
  assert.ok(streamedGenerationIndex > validateIndex);
  assert.ok(jsonGenerationIndex > validateIndex);
  assert.match(route, /status: parsedRequest\.status/);
  assert.match(route, /limitIssues: validation\.limitIssues/);
});

test("MCP generation schemas advertise the shared server ceilings", async () => {
  const tools = await readFile(new URL("../../mcp/lib/tools.mjs", import.meta.url), "utf8");
  assert.match(tools, /maxLength: GENERATION_LIMITS\.projectNameChars/);
  assert.match(tools, /maxLength: GENERATION_LIMITS\.notesChars/);
  assert.match(tools, /maxLength: GENERATION_LIMITS\.audienceChars/);
  assert.match(tools, /maxLength: GENERATION_LIMITS\.linksChars/);
  assert.match(tools, /maxItems: GENERATION_LIMITS\.channels/);
  assert.match(tools, /maxItems: GENERATION_LIMITS\.documentItems/);
  assert.match(tools, /maxItems: GENERATION_LIMITS\.sourceRecordsPerKind/);
});
