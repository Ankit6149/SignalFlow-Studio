import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("../app/page.js", import.meta.url);
const workflowUrl = new URL("../app/studio-product.css", import.meta.url);

test("Destinations exposes Core, All, and Clear selection shortcuts", async () => {
  const page = await readFile(pageUrl, "utf8");
  assert.match(page, /onClick=\{useCoreChannels\}>Core/);
  assert.match(page, /onClick=\{selectAllChannels\}>All/);
  assert.match(page, /onClick=\{\(\) => setChannels\(\[\]\)\}>Clear/);
});

test("advanced provider fields use native progressive disclosure", async () => {
  const page = await readFile(pageUrl, "utf8");
  const audience = page.indexOf('<div className="model-route-core">');
  const details = page.indexOf('<details className="model-route-advanced">');
  const apiKey = page.indexOf('<span>Temporary API key</span>');
  const modelOverride = page.indexOf('<span>Model override</span>');
  const connectionTest = page.indexOf('onClick={testProviderConnection}');
  assert.ok(audience > -1 && details > audience);
  assert.ok(apiKey > details && modelOverride > details);
  assert.ok(connectionTest > details);
  assert.match(page, /<summary>[\s\S]*Advanced model settings[\s\S]*<\/summary>/);
});

test("Destinations disclosure and blocker messages remain accessible and mobile safe", async () => {
  const css = await readFile(workflowUrl, "utf8");
  assert.match(css, /\.model-route-advanced summary:focus-visible/);
  assert.match(css, /\.model-route-message \{[\s\S]*overflow-wrap:\s*anywhere/);
  assert.match(css, /@media \(max-width: 68rem\)[\s\S]*\.model-route-panel \{[\s\S]*position:\s*static/);
  assert.doesNotMatch(css, /\.model-route-panel \{[^}]*position:\s*fixed/s);
});
