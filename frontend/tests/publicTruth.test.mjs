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

test("structured data is valid JSON and states current approval-first provider and publication boundaries", () => {
  const schema = JSON.parse(read("frontend/public/schema.jsonld"));
  const serialized = JSON.stringify(schema);
  assert.match(serialized, /approval-first content operating system/i);
  assert.match(serialized, /provider-neutral inference boundary/i);
  assert.match(serialized, /exact visible revision/i);
  assert.match(serialized, /external outcome is confirmed/i);
  assert.match(serialized, /GitHub source connections, ProjectContext, Signals, Opportunities/i);
  assert.doesNotMatch(serialized, /deterministic local template/i);
  assert.doesNotMatch(serialized, /Publish through configured LinkedIn, X, and Reddit/i);
});

test("README states current provider, persistence, extension, export, and verification boundaries", () => {
  const readme = read("README.md");
  assert.match(readme, /at least one real model provider route for real campaign generation/i);
  assert.match(readme, /expose capability discovery/i);
  assert.match(readme, /browser-local/i);
  assert.match(readme, /authoritative current draft/i);
  assert.match(readme, /acknowledged full extension screenshot\/recording ingestion/i);
  assert.match(readme, /not yet implemented as production capabilities/i);
  assert.match(readme, /npm test/);
  assert.match(readme, /npm audit --omit=dev --audit-level=high/);
  assert.match(readme, /npm run build/);
});
