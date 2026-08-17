import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("../app/page.js", import.meta.url);
const workflowUrl = new URL("../app/studio-product.css", import.meta.url);
const decisionUrl = new URL("../app/studio-decision-flow.css", import.meta.url);

test("Destinations exposes Core, All, and Clear selection shortcuts", async () => {
  const page = await readFile(pageUrl, "utf8");
  assert.match(page, /onClick=\{useCoreChannels\}>Core/);
  assert.match(page, /onClick=\{selectAllChannels\}>All/);
  assert.match(page, /onClick=\{\(\) => setChannels\(\[\]\)\}>Clear/);
});

test("first-run credentials stay in the primary route while overrides remain Advanced", async () => {
  const page = await readFile(pageUrl, "utf8");
  const core = page.indexOf('<div className="model-route-core">');
  const primaryKey = page.indexOf('providerCredentialPlacement === "primary"');
  const details = page.indexOf('<details className="model-route-advanced">');
  const detailsClose = page.indexOf("</details>", details);
  const advancedKey = page.indexOf('providerCredentialPlacement === "advanced"');
  const modelOverride = page.indexOf("<span>Model override</span>");
  const connectionTest = page.indexOf("onClick={testProviderConnection}");

  assert.ok(core > -1);
  assert.ok(primaryKey > core && primaryKey < details);
  assert.ok(details > primaryKey);
  assert.ok(detailsClose > details);
  assert.ok(advancedKey > details && advancedKey < detailsClose);
  assert.ok(modelOverride > details && modelOverride < detailsClose);
  assert.ok(connectionTest > detailsClose);
  assert.match(page, /getProviderCredentialPlacement\(\{[\s\S]*provider:\s*form\.provider[\s\S]*providerStatuses\[form\.provider\]/);
  assert.match(page, /No server credential is available for this route\.[\s\S]*browser session/);
  assert.match(page, /<summary>[\s\S]*Advanced model settings[\s\S]*<\/summary>/);
  assert.doesNotMatch(page, /!\['ollama', 'lmstudio'\]\.includes\(form\.provider\) && \([\s\S]*Temporary API key/);
});

test("one controlled temporary key powers primary setup and Advanced overrides", async () => {
  const page = await readFile(pageUrl, "utf8");
  const keyValues = page.match(/value=\{form\.apiKey\}/g) || [];
  const keyUpdates = page.match(/updateForm\("apiKey", event\.target\.value\)/g) || [];

  assert.equal(keyValues.length, 2);
  assert.equal(keyUpdates.length, 2);
  assert.match(page, /providerCredentialPlacement === "primary"/);
  assert.match(page, /providerCredentialPlacement === "advanced"/);
  assert.match(page, /Temporary keys are sent only with this request\. SignalFlow does not save them in the campaign library\./);
});

test("model routing remains reachable but no longer permanently squeezes destination choices", async () => {
  const [product, decision] = await Promise.all([
    readFile(workflowUrl, "utf8"),
    readFile(decisionUrl, "utf8"),
  ]);
  assert.match(product, /\.model-route-primary-key \{[\s\S]*overflow-wrap|\.model-route-primary-key small \{[\s\S]*overflow-wrap:\s*anywhere/);
  assert.match(product, /\.model-route-advanced summary:focus-visible/);
  assert.match(product, /\.model-route-message \{[\s\S]*overflow-wrap:\s*anywhere/);
  assert.match(decision, /data-stage="destinations"\] \.output-panel[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(decision, /data-stage="destinations"\] \.model-route-panel[\s\S]*position:\s*static/);
  assert.match(decision, /data-stage="destinations"\] \.model-route-panel[\s\S]*width:\s*min\(100%, 58rem\)/);
  assert.doesNotMatch(decision, /data-stage="destinations"\] \.model-route-panel[^{]*\{[^}]*position:\s*fixed/s);
});
