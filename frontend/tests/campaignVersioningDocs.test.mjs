import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDir, "../..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("README and agent guide describe edit-safe regeneration and stable identity", () => {
  const readme = read("README.md");
  const agents = read("AGENTS.md");
  for (const content of [readme, agents]) {
    assert.match(content, /regenerate only unedited/i);
    assert.match(content, /archive.*regenerate/i);
    assert.match(content, /save as copy/i);
    assert.match(content, /stable.*campaignId|stable campaign identity/is);
    assert.match(content, /approval/i);
  }
});

test("architecture and migration runbooks cover editor-state v2 and duplicate-title safety", () => {
  const architecture = read("docs/DOMAIN_ARCHITECTURE.md");
  const migration = read("docs/CAMPAIGN_SCHEMA_MIGRATION.md");
  const editing = read("docs/CAMPAIGN_EDITING_AND_VERSIONING.md");
  assert.match(architecture, /editor reducer schema is version `2`/i);
  assert.match(architecture, /campaign titles are not identity/i);
  assert.match(migration, /editor-state v2/i);
  assert.match(migration, /save as copy allocates a new ID/i);
  assert.match(editing, /never replaces a manually edited draft silently/i);
  assert.match(editing, /role="status"/i);
  assert.match(editing, /browser quota/i);
});
