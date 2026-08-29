import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createCapabilitySnapshot,
  parseCapabilitySnapshot,
  PORTABLE_TRANSFER_BROWSER_MAX_BYTES,
  PORTABLE_TRANSFER_SCHEMA_VERSION,
} from "../lib/capabilities/capabilityContract.mjs";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(testDir, "..");
const repositoryRoot = path.resolve(frontendRoot, "..");
const readFrontend = (relative) => fs.readFileSync(path.join(frontendRoot, relative), "utf8");
const readRepository = (relative) => fs.readFileSync(path.join(repositoryRoot, relative), "utf8");

test("Library renders the browser transfer application as a real product surface", () => {
  const page = readFrontend("app/page.js");
  assert.match(page, /import PortableTransferPanel from "\.\.\/components\/PortableTransferPanel"/);
  assert.match(page, /<PortableTransferPanel/);
  assert.match(page, /campaigns=\{library\}/);
  assert.match(page, /onLibraryChanged=\{async \(\) =>/);
  assert.match(page, /setLibrary\(await campaignApplication\.listCampaigns\(\)\)/);
});

test("portable transfer UI exposes preparation validation conflicts cancellation resume and rollback", () => {
  const component = readFrontend("components/PortableTransferPanel.js");
  assert.match(component, /Prepare archive/);
  assert.match(component, /Download \.signalflow\.json/);
  assert.match(component, /campaignIds: selectedCampaignIds/);
  assert.match(component, /previewImport/);
  assert.match(component, /Import reviewed archive/);
  assert.match(component, /TRANSFER_CONFLICT_POLICIES\.SKIP/);
  assert.match(component, /TRANSFER_CONFLICT_POLICIES\.COPY/);
  assert.match(component, /TRANSFER_CONFLICT_POLICIES\.REPLACE/);
  assert.match(component, /Cancel import/);
  assert.match(component, /resumeImport/);
  assert.match(component, /rollbackImport/);
  assert.match(component, /Confirm transfer rollback/);
  assert.match(component, /role="alert"/);
  assert.match(component, /aria-live="polite"/);
  assert.match(component, /Hosted workspaces will use the same contract when a hosted adapter is connected/);
  assert.doesNotMatch(component, /cloud database is available|sync enabled|uploaded automatically/i);
});

test("portable transfer layout contains responsive zoom-safe and reduced-motion rules", () => {
  const css = readFrontend("components/PortableTransferPanel.module.css");
  assert.match(css, /@media \(max-width: 64rem\)/);
  assert.match(css, /@media \(max-width: 48rem\)/);
  assert.match(css, /@media \(max-width: 30rem\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /focus-visible/);
  assert.match(css, /overflow-wrap: anywhere/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\)/);
});

test("capability contract distinguishes browser transfer from unavailable hosted transfer", () => {
  const snapshot = createCapabilitySnapshot();
  assert.equal(snapshot.capabilities.transfer.portableArchive.available, true);
  assert.equal(snapshot.capabilities.transfer.browserImportExport.available, true);
  assert.equal(snapshot.capabilities.transfer.hostedImport.available, false);
  assert.equal(snapshot.capabilities.transfer.signatures.available, false);
  assert.equal(snapshot.capabilities.transfer.silentSync.available, false);
  assert.equal(snapshot.capabilities.transfer.portableArchive.schemaVersion, PORTABLE_TRANSFER_SCHEMA_VERSION);
  assert.equal(snapshot.capabilities.transfer.portableArchive.maxBrowserBytes, PORTABLE_TRANSFER_BROWSER_MAX_BYTES);

  const parsed = parseCapabilitySnapshot(snapshot);
  assert.deepEqual(parsed.capabilities.transfer, snapshot.capabilities.transfer);

  const hosted = createCapabilitySnapshot({
    transfer: { hostedImport: true, signatures: true },
  });
  assert.equal(hosted.capabilities.transfer.hostedImport.available, true);
  assert.equal(hosted.capabilities.transfer.signatures.available, true);
  assert.equal(hosted.capabilities.transfer.silentSync.available, false);
});

test("missing transfer declarations fail closed in compatible clients", () => {
  const snapshot = createCapabilitySnapshot();
  delete snapshot.capabilities.transfer.hostedImport;
  delete snapshot.capabilities.transfer.signatures;
  const parsed = parseCapabilitySnapshot(snapshot);
  assert.equal(parsed.capabilities.transfer.hostedImport.available, false);
  assert.equal(parsed.capabilities.transfer.signatures.available, false);
  assert.match(parsed.capabilities.transfer.hostedImport.reason, /not declared/i);
});

test("portable transfer documentation and public AI context remain truthful", () => {
  const readme = readRepository("README.md");
  const agents = readRepository("AGENTS.md");
  const capabilityMatrix = readRepository("docs/CAPABILITY_MATRIX.md");
  const architecture = readRepository("docs/DOMAIN_ARCHITECTURE.md");
  const transferDoc = readRepository("docs/PORTABLE_TRANSFER.md");
  const llms = readRepository("llms.txt");
  const publicLlms = readFrontend("public/llms.txt");
  const llmsFull = readRepository("llms-full.txt");
  const publicLlmsFull = readFrontend("public/llms-full.txt");

  assert.match(readme, /browser portable archive\/import\/export exists/i);
  assert.match(readme, /docs\/PORTABLE_TRANSFER\.md/);
  assert.match(readme, /no production cloud campaign database\/account workspace\/cross-device sync yet/i);
  assert.match(agents, /portable browser archive\/import\/export/i);
  assert.match(capabilityMatrix, /Production hosted workspace transfer destination \| Not implemented/);
  assert.match(architecture, /TransferReport/);
  assert.match(architecture, /import validation\/outcomes\/resume\/rollback journal/i);
  assert.match(transferDoc, /This feature is \*\*not synchronization\*\*/);
  assert.match(transferDoc, /SHA-256/);
  assert.match(transferDoc, /Skip/);
  assert.match(transferDoc, /Copy/);
  assert.match(transferDoc, /Replace/);
  assert.match(transferDoc, /rollback journal/i);
  assert.equal(llms, publicLlms);
  assert.equal(llmsFull, publicLlmsFull);
  assert.match(llms, /explicit `\.signalflow\.json` archive preparation/i);
  assert.match(llmsFull, /## (?:\d+\.\s+)?Portable transfer and recovery/);
  assert.match(llmsFull, /production hosted transfer service.*does not/is/);
});

test("public structured metadata matches the current Content OS without false publication claims", () => {
  const layout = readFrontend("app/layout.js");
  const structuredData = JSON.parse(readFrontend("public/schema.jsonld"));
  const serialized = JSON.stringify(structuredData);

  for (const claim of [
    "Capture manual ContentSignals without requiring an AI call",
    "Connect verified GitHub repositories with bounded exact-revision context",
    "Approve one exact visible revision and invalidate approval after later edits or regeneration",
  ]) {
    assert.ok(layout.includes(claim), `layout metadata should include current claim: ${claim}`);
    assert.ok(serialized.includes(claim), `static structured data should include current claim: ${claim}`);
  }

  assert.match(serialized, /publication is kept separate from preparation until the external outcome is confirmed/i);
  assert.doesNotMatch(
    serialized,
    /Publish through configured LinkedIn, X, and Reddit|current SignalFlow Studio turns manual source context into editable destination drafts/i,
  );
});
