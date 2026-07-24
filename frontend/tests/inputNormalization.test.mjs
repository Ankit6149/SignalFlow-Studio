import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeDocumentText,
  normalizeTextInput,
} from "../lib/package/inputNormalization.mjs";

test("normalizes the browser document_text array without throwing", () => {
  assert.deepEqual(
    normalizeDocumentText([
      " FILE: alpha.md\nAlpha content ",
      "FILE: beta.txt\nBeta content",
    ]),
    ["FILE: alpha.md\nAlpha content", "FILE: beta.txt\nBeta content"],
  );
});

test("extracts text from structured and nested upload payloads", () => {
  assert.deepEqual(
    normalizeDocumentText([
      { name: "ignored.md", content: " First document " },
      { document_text: ["Second document", { text: " Third document " }] },
    ]),
    ["First document", "Second document", "Third document"],
  );
});

test("ignores null and metadata-only objects", () => {
  assert.deepEqual(
    normalizeDocumentText([null, undefined, {}, { name: "asset.png" }]),
    [],
  );
});

test("normalizes scalar request values safely", () => {
  assert.equal(normalizeTextInput("  campaign  "), "campaign");
  assert.equal(normalizeTextInput(42), "42");
  assert.equal(normalizeTextInput(false), "false");
  assert.equal(normalizeTextInput({ content: "  proof  " }), "proof");
});
