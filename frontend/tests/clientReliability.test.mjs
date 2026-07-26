import test from "node:test";
import assert from "node:assert/strict";

import {
  createSourceSnapshot,
  resolveStudioStage,
  restoreSourceSnapshot,
  selectAcceptedFiles,
} from "../lib/studio/clientReliability.mjs";

test("unknown wizard stages never open a blank review workspace", () => {
  assert.equal(resolveStudioStage("compose"), "source");
  assert.equal(resolveStudioStage("compose", { hasSource: true }), "destinations");
  assert.equal(resolveStudioStage("compose", { hasSource: true, hasResult: true }), "review");
});

test("review and destinations remain guarded by available state", () => {
  assert.equal(resolveStudioStage("destinations"), "source");
  assert.equal(resolveStudioStage("review", { hasSource: true }), "destinations");
  assert.equal(resolveStudioStage("review", { hasSource: true, hasResult: true }), "review");
});

test("file selection keeps metadata and extracted text within one shared limit", () => {
  const picked = Array.from({ length: 5 }, (_, index) => ({ name: `file-${index}` }));
  const result = selectAcceptedFiles(picked, 10, 12);
  assert.deepEqual(result.accepted.map((file) => file.name), ["file-0", "file-1"]);
  assert.equal(result.skippedCount, 3);
});

test("saved campaigns preserve uploaded source context", () => {
  const snapshot = createSourceSnapshot(
    [{ name: "brief.md", type: "text/markdown", size: 20, extracted: true, description: "Extracted" }],
    ["FILE: brief.md\nProduct evidence"],
  );
  const restored = restoreSourceSnapshot(snapshot);
  assert.deepEqual(restored, snapshot);
});
