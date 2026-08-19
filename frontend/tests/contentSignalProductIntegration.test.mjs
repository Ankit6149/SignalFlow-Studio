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
  assert.match(ports, /contentSignalRepository: \["list", "get", "upsert", "remove", "findByExternalEvent", "insertExternalIfAbsent"\]/);
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

test("Signals supports explicit review preparation without claiming automatic connected-source intelligence", () => {
  const route = readFrontend("app/signals/page.js");
  const ui = readFrontend("components/SignalsWorkspace.js");
  assert.match(route, /<SignalsWorkspace \/>/);
  assert.match(ui, /SIGNALS · OWNER ALPHA/);
  assert.match(ui, /Save signal/);
  assert.match(ui, /No AI call to save/);
  assert.match(ui, /Saving does not call AI, approve content, or publish anything/);
  assert.match(ui, /Prepare for review/);
  assert.match(ui, /createBrowserGoldenPathAutopilotApplication/);
  assert.match(ui, /autopilotApplication\.prepareSignal\(signalId\)/);
  assert.match(ui, /0<\/strong><span>Automatic detections<\/span><small>Connected-source detection is not implemented/);
  assert.match(ui, /Uncertain work stops in Plan/);
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

test("capability documentation distinguishes connected-source code from production automatic detection", () => {
  const matrix = readRepository("docs/CAPABILITY_MATRIX.md");
  const implementation = readRepository("docs/CONTENT_SIGNAL_IMPLEMENTATION.md");
  assert.match(matrix, /Browser-local manual `ContentSignal` intake.*Available/);
  assert.match(matrix, /GitHub App\/webhook → ContentSignal ingestion \| Implementation in progress:/);
  assert.match(matrix, /GitHub App install lifecycle, dedicated database migration\/configuration, production secrets and real webhook acceptance are not yet complete/i);
  assert.match(matrix, /Canonical `ContentSignal` persistence\/manual intake \| Implemented browser-local; hosted persistence\/automatic ingestion still planned/);
  assert.match(implementation, /manual signal is not a post, campaign, or opportunity/i);
  assert.match(implementation, /not yet included in the portable campaign archive/i);
  assert.match(implementation, /production automatic detection is not yet configured or verified/i);
});
