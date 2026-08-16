import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDir, "../..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("README and agent guide preserve edit-safe current campaign invariants", () => {
  const readme = read("README.md");
  const agents = read("AGENTS.md");

  assert.match(readme, /stable campaign IDs and edit-safe draft history/i);
  assert.match(readme, /authoritative current draft/i);
  assert.match(readme, /approval/i);
  assert.match(readme, /docs\/CAMPAIGN_EDITING_AND_VERSIONING\.md/);

  assert.match(agents, /Never replace an edited draft silently/i);
  assert.match(agents, /Per-channel regeneration mutates only the requested channel/i);
  assert.match(agents, /Save updates the current stable ID; Save as copy allocates a new ID/i);
  assert.match(agents, /Current edited revision is authoritative/i);
  assert.match(agents, /approval/i);
});

test("architecture and migration runbooks preserve stable identity and editor-state migration safety", () => {
  const architecture = read("docs/DOMAIN_ARCHITECTURE.md");
  const migration = read("docs/CAMPAIGN_SCHEMA_MIGRATION.md");
  const editing = read("docs/CAMPAIGN_EDITING_AND_VERSIONING.md");
  assert.match(architecture, /stable campaign ID\/schema/i);
  assert.match(architecture, /campaign title is not identity/i);
  assert.match(architecture, /Save updates current stable ID; Save as copy allocates a new ID/i);
  assert.match(migration, /editor-state v2/i);
  assert.match(migration, /save as copy allocates a new ID/i);
  assert.match(editing, /never replaces a manually edited draft silently/i);
  assert.match(editing, /role="status"/i);
  assert.match(editing, /browser quota/i);
});
