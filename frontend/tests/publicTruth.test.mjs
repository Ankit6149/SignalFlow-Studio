import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../..");
const read = (relative) => fs.readFileSync(path.join(repoRoot, relative), "utf8");

const publicTruthFiles = [
  "README.md",
  "AGENTS.md",
  "docs/PRODUCT_GRADE_OPEN_SOURCE.md",
  "llms.txt",
  "llms-full.txt",
  "frontend/public/llms.txt",
  "frontend/public/llms-full.txt",
];

const retiredClaims = [
  /deterministic local template/i,
  /deterministic no-key/i,
  /works without an external api key/i,
  /automatic fallback generation/i,
  /demo\/template mode should work/i,
  /useful without an api key/i,
];

test("public documentation does not advertise retired template or fallback generation", () => {
  for (const relative of publicTruthFiles) {
    const content = read(relative);
    for (const pattern of retiredClaims) {
      assert.doesNotMatch(content, pattern, `${relative} contains retired product wording`);
    }
  }
});

test("root and deployed AI-context files remain identical", () => {
  assert.equal(read("llms.txt"), read("frontend/public/llms.txt"));
  assert.equal(read("llms-full.txt"), read("frontend/public/llms-full.txt"));
});

test("README states the real provider, storage, extension, export, and verification boundaries", () => {
  const readme = read("README.md");
  assert.match(readme, /requires a real model provider/i);
  assert.match(readme, /GET `?\/api\/capabilities`?/i);
  assert.match(readme, /browser-local/i);
  assert.match(readme, /authoritative current draft/i);
  assert.match(readme, /extension.*acknowledged ingestion.*not implemented/is);
  assert.match(readme, /npm test/);
  assert.match(readme, /npm audit --omit=dev --audit-level=high/);
  assert.match(readme, /npm run build/);
});
