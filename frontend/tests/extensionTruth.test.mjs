import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../..");
const read = (relative) => fs.readFileSync(path.join(repoRoot, relative), "utf8");

test("experimental extension surfaces state their real capability boundary", () => {
  const readme = read("extension/README.md");
  const manifest = JSON.parse(read("extension/manifest.json"));
  const background = read("extension/background.js");
  const content = read("extension/content.js");
  const matrix = read("docs/CAPABILITY_MATRIX.md");

  assert.match(readme, /Status: experimental \/ not production capture/i);
  assert.match(readme, /does not.*acknowledged durable context ingestion/is);
  assert.match(readme, /does not.*screenshot capture/is);
  assert.match(readme, /does not.*recording/is);
  assert.match(readme, /acknowledged: false/i);

  assert.match(manifest.description, /Experimental SignalFlow capability-handshake scaffold/i);
  assert.doesNotMatch(manifest.description, /record screen walkthroughs|capture mockups/i);

  assert.match(content, /acknowledged:\s*false/);
  assert.match(background, /did not acknowledge durable ingestion/i);
  assert.match(matrix, /Acknowledged extension ingestion \| Not implemented/);
  assert.match(matrix, /Extension screenshot\/recording ingestion \| Not implemented/);
});
