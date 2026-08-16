import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(testDir, "..");
const repositoryRoot = path.resolve(frontendRoot, "..");
const readFrontend = (relative) => fs.readFileSync(path.join(frontendRoot, relative), "utf8");
const readRepository = (relative) => fs.readFileSync(path.join(repositoryRoot, relative), "utf8");

test("ContentSignal is a first-class workspace-owned domain record behind a repository port", () => {
  const contracts = readFrontend("lib/domain/contracts.mjs");
  const ports = readFrontend("lib/domain/ports.mjs");
  const domain = readFrontend("lib/domain/contentSignals.mjs");
  assert.match(contracts, /CONTENT_SIGNAL: "ContentSignal"/);
  assert.match(contracts, /ContentSignal: \{ idField: "signalId", owner: "workspace"/);
  assert.match(ports, /contentSignalRepository: \["list", "get", "upsert", "remove"\]/);
  assert.match(domain, /CONTENT_SIGNAL_SCHEMA_VERSION = 1/);
  assert.match(domain, /WORKSPACE_PRIVATE/);
  assert.match(domain, /provenance/);
  assert.doesNotMatch(domain, /CampaignApplication|createCampaign/);
});

test("manual signal application owns lifecycle instead of UI or localStorage", () => {
  const application = readFrontend("lib/application/contentSignalApplication.mjs");
  const ui = readFrontend("components/SignalsWorkspace.js");
  for (const operation of [
    "createManualSignal",
    "listSignals",
    "readSignal",
    "updateSignalMetadata",
    "ignoreSignal",
    "snoozeSignal",
    "archiveSignal",
    "attachSignalToProject",
    "attachSourceToSignal",
  ]) {
    assert.match(application, new RegExp(operation));
  }
  assert.match(application, /workspaceId/);
  assert.match(application, /SourceArtifact .* does not exist/);
  assert.match(application, /Asset .* does not exist/);
  assert.match(ui, /application\.createManualSignal/);
  assert.match(ui, /application\.ignoreSignal/);
  assert.match(ui, /application\.snoozeSignal/);
  assert.match(ui, /application\.archiveSignal/);
  assert.doesNotMatch(ui, /localStorage\.(setItem|getItem|removeItem)/);
});

test("Signals route is usable manual intake and explicitly does not claim automatic intelligence", () => {
  const route = readFrontend("app/signals/page.js");
  const ui = readFrontend("components/SignalsWorkspace.js");
  assert.match(route, /<SignalsWorkspace \/>/);
  assert.match(ui, /SIGNALS · AVAILABLE NOW/);
  assert.match(ui, /Save signal/);
  assert.match(ui, /No AI call/);
  assert.match(ui, /Nothing was generated or published/);
  assert.match(ui, /0<\/strong><span>Automatic detections<\/span><small>Not implemented/);
  assert.match(ui, /Cloud sync and automatic event detection are not claimed here/);
  assert.doesNotMatch(ui, /fetch\(|\/api\/launch_kit|generateCampaign|publishCampaign/);
});

test("Signals workspace is responsive, zoom-safe, keyboard-visible, and reduced-motion aware", () => {
  const css = readFrontend("components/SignalsWorkspace.module.css");
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /overflow-x: clip/);
  assert.match(css, /overflow-wrap: anywhere/);
  assert.match(css, /grid-template-columns: 1fr/);
});

test("current campaign application remains independent from ContentSignal creation", () => {
  const campaignApplication = readFrontend("lib/application/campaignApplication.mjs");
  const browserCampaignApplication = readFrontend("lib/application/browserCampaignApplication.mjs");
  assert.doesNotMatch(campaignApplication, /contentSignal/i);
  assert.doesNotMatch(browserCampaignApplication, /contentSignal/i);
});

test("capability documentation keeps automatic signals planned while manual intake is implemented", () => {
  const matrix = readRepository("docs/CAPABILITY_MATRIX.md");
  const implementation = readRepository("docs/CONTENT_SIGNAL_IMPLEMENTATION.md");
  assert.match(matrix, /Browser-local manual `ContentSignal` intake.*Available/);
  assert.match(matrix, /Automatic signal detection.*Not implemented/);
  assert.match(matrix, /Canonical `ContentSignal` persistence\/manual intake \| Implemented/);
  assert.match(implementation, /manual signal is not a post, campaign, or opportunity/i);
  assert.match(implementation, /not yet included in the portable campaign archive/i);
  assert.match(implementation, /automatic event detection remains unimplemented/i);
});
