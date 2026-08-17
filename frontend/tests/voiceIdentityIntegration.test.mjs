import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(testDir, "..");
const read = (relative) => fs.readFileSync(path.join(frontendRoot, relative), "utf8");

test("Voice is a real shared-shell route and not a compatibility tone dropdown", () => {
  const shell = read("components/WorkspaceShell.js");
  const route = read("app/voice/page.js");
  const ui = read("components/VoiceWorkspace.js");
  assert.match(shell, /id: "voice", label: "Voice", href: "\/voice", status: "available"/);
  assert.match(route, /<VoiceWorkspace \/>/);
  assert.match(ui, /activeItem="voice"/);
  assert.match(ui, /Teach SignalFlow what should remain recognizably you/);
  assert.match(ui, /Desired perception|PERCEPTION/);
  assert.match(ui, /BOUNDARIES/);
  assert.doesNotMatch(ui, /founder-style|tone preset.*select/i);
});

test("identity generation context is versioned and shared outside the UI", () => {
  const domain = read("lib/domain/identityProfiles.mjs");
  const application = read("lib/application/identityApplication.mjs");
  assert.match(domain, /IDENTITY_PRECEDENCE/);
  assert.match(domain, /IdentityContextSnapshot/);
  assert.match(application, /createIdentityContextSnapshot/);
  assert.match(application, /profileRefs/);
  assert.match(application, /effectiveRules/);
  assert.match(application, /explicit_boundary/);
  assert.match(application, /platform_preference/);
  assert.match(application, /global_identity_voice/);
});

test("explicit boundary checks can block before future publication", () => {
  const domain = read("lib/domain/identityProfiles.mjs");
  assert.match(domain, /evaluateExplicitBoundaryText/);
  assert.match(domain, /blocked_phrase/);
  assert.match(domain, /prohibited_project_claim/);
  assert.match(domain, /exaggerated_launch_language/);
});

test("Voice follows the same restrained SignalFlow visual system", () => {
  const css = read("components/VoiceWorkspace.module.css");
  assert.match(css, /#171714/);
  assert.match(css, /#fffdf8/);
  assert.match(css, /#8b6a28/);
  assert.match(css, /border-radius: \.65rem/);
  assert.match(css, /@media \(max-width: 1000px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(css, /border-radius:\s*(?:2[0-9]|[3-9][0-9])px/);
});
