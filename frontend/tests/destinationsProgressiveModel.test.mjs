import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("../app/page.js", import.meta.url);
const destinationsUrl = new URL("../components/DestinationsStage.js", import.meta.url);
const providerControllerUrl = new URL("../lib/studio/useProviderRouteController.js", import.meta.url);
const workflowUrl = new URL("../app/studio-product.css", import.meta.url);
const decisionUrl = new URL("../app/studio-product.css", import.meta.url);

test("Destinations exposes Core, All, and Clear selection shortcuts", async () => {
  const [page, destinations] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(destinationsUrl, "utf8"),
  ]);
  assert.match(page, /onUseCoreChannels=\{useCoreChannels\}/);
  assert.match(page, /onSelectAllChannels=\{selectAllChannels\}/);
  assert.match(page, /onClearChannels=\{clearChannels\}/);
  assert.match(destinations, /onClick=\{onUseCoreChannels\}>Core/);
  assert.match(destinations, /onClick=\{onSelectAllChannels\}>All/);
  assert.match(destinations, /onClick=\{onClearChannels\}>Clear/);
});

test("first-run credentials stay in the primary route while overrides remain Advanced", async () => {
  const [page, destinations, providerController] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(destinationsUrl, "utf8"),
    readFile(providerControllerUrl, "utf8"),
  ]);
  const core = destinations.indexOf('<div className="model-route-core">');
  const primaryKey = destinations.indexOf('providerCredentialPlacement === "primary"');
  const details = destinations.indexOf('<details className="model-route-advanced">');
  const detailsClose = destinations.indexOf("</details>", details);
  const advancedKey = destinations.indexOf('providerCredentialPlacement === "advanced"');
  const modelOverride = destinations.indexOf("<span>Model override</span>");
  const connectionTest = destinations.indexOf("onClick={onTestProviderConnection}");

  assert.ok(core > -1);
  assert.ok(primaryKey > core && primaryKey < details);
  assert.ok(details > primaryKey);
  assert.ok(detailsClose > details);
  assert.ok(advancedKey > details && advancedKey < detailsClose);
  assert.ok(modelOverride > details && modelOverride < detailsClose);
  assert.ok(connectionTest > detailsClose);
  assert.match(page, /useProviderRouteController\(\{ form, setForm \}\)/);
  assert.match(providerController, /getProviderCredentialPlacement\(\{[\s\S]*provider:\s*form\.provider[\s\S]*providerStatuses\[form\.provider\]/);
  assert.match(destinations, /No server credential is available for this route\.[\s\S]*browser session/);
  assert.match(destinations, /<summary>[\s\S]*Advanced model settings[\s\S]*<\/summary>/);
  assert.doesNotMatch(destinations, /!\['ollama', 'lmstudio'\]\.includes\(form\.provider\) && \([\s\S]*Temporary API key/);
});

test("one controlled temporary key powers primary setup and Advanced overrides", async () => {
  const destinations = await readFile(destinationsUrl, "utf8");
  const keyValues = destinations.match(/value=\{form\.apiKey\}/g) || [];
  const keyUpdates = destinations.match(/onUpdateForm\("apiKey", event\.target\.value\)/g) || [];

  assert.equal(keyValues.length, 2);
  assert.equal(keyUpdates.length, 2);
  assert.match(destinations, /providerCredentialPlacement === "primary"/);
  assert.match(destinations, /providerCredentialPlacement === "advanced"/);
  assert.match(destinations, /Temporary keys are sent only with this request\. SignalFlow does not save them in the campaign library\./);
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
