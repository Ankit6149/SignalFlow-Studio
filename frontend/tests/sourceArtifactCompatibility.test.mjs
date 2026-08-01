import assert from "node:assert/strict";
import test from "node:test";

import { normalizeSourceArtifact } from "../lib/domain/sourceArtifacts.mjs";

const now = "2026-08-01T00:00:00.000Z";

function sourceArtifact(overrides = {}) {
  return normalizeSourceArtifact({
    sourceArtifactId: "source-compatibility-1",
    workspaceId: "workspace-compatibility",
    sourceKind: "upload",
    ingestionMethod: "browser_upload",
    originalName: "reference.png",
    mimeType: "image/png",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }, {
    workspaceId: "workspace-compatibility",
    now,
  });
}

test("canonical assetIds remain authoritative while assetId preserves legacy readers", () => {
  const artifact = sourceArtifact({ assetIds: ["asset-z", "asset-a", "asset-a"] });

  assert.deepEqual(artifact.assetIds, ["asset-a", "asset-z"]);
  assert.equal(artifact.assetId, "asset-a");
});

test("a legacy scalar assetId migrates into the canonical array without loss", () => {
  const artifact = sourceArtifact({ assetId: "asset-legacy-1" });

  assert.deepEqual(artifact.assetIds, ["asset-legacy-1"]);
  assert.equal(artifact.assetId, "asset-legacy-1");
});
