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
  "docs/CAPABILITY_MATRIX.md",
  "docs/DOMAIN_ARCHITECTURE.md",
  "llms.txt",
  "llms-full.txt",
  "frontend/public/llms.txt",
  "frontend/public/llms-full.txt",
  "frontend/app/privacy/page.js",
  "frontend/app/opengraph-image.js",
  "frontend/public/schema.jsonld",
];

const affirmativeRetiredClaims = [
  /choose a deterministic local template/i,
  /includes? a deterministic local template/i,
  /deterministic local template route that needs no api key/i,
  /deterministic no-key generation/i,
  /works without an external api key/i,
  /automatic fallback generation when/i,
  /demo\/template mode should work/i,
  /useful without an api key/i,
  /local templates or your own model/i,
  /supports local templates/i,
];

test("public product surfaces do not advertise retired template or fallback generation", () => {
  for (const relative of publicTruthFiles) {
    const content = read(relative);
    for (const pattern of affirmativeRetiredClaims) {
      assert.doesNotMatch(content, pattern, `${relative} contains an affirmative retired product claim`);
    }
  }
});

test("root and deployed AI-context files remain identical", () => {
  assert.equal(read("llms.txt"), read("frontend/public/llms.txt"));
  assert.equal(read("llms-full.txt"), read("frontend/public/llms-full.txt"));
});

test("structured data is valid JSON and states real-model canonical storage behavior", () => {
  const schema = JSON.parse(read("frontend/public/schema.jsonld"));
  const serialized = JSON.stringify(schema);
  assert.match(serialized, /real model provider route/i);
  assert.match(serialized, /versioned campaign records/i);
  assert.doesNotMatch(serialized, /deterministic local template/i);
});

test("README states the real provider, storage, extension, export, and verification boundaries", () => {
  const readme = read("README.md");
  assert.match(readme, /requires a real model provider/i);
  assert.match(readme, /GET `?\/api\/capabilities`?/i);
  assert.match(readme, /browser-local/i);
  assert.match(readme, /authoritative current draft/i);
  assert.match(readme, /acknowledged extension ingestion is not implemented/i);
  assert.match(readme, /npm test/);
  assert.match(readme, /npm audit --omit=dev --audit-level=high/);
  assert.match(readme, /npm run build/);
});
