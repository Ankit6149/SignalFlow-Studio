import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("Signals resolves Opportunity relationships from canonical signalIds", async () => {
  const component = await source("../components/SignalsWorkspace.js");
  assert.match(component, /opportunityApplication\.listRankedOpportunities\(\{ includeRejected: true \}\)/);
  assert.match(component, /for \(const signalId of opportunity\.signalIds \|\| \[\]\)/);
  assert.match(component, /opportunityBySignalId\.get\(signal\.signalId\)/);
  assert.match(component, /Date\.parse\(right\.updatedAt \|\| right\.createdAt/);
  assert.doesNotMatch(component, /headline.*opportunity.*match|summary.*opportunity.*match/i);
});

test("Signal detail exposes the current Opportunity and navigates directly to its Plan", async () => {
  const component = await source("../components/SignalsWorkspace.js");
  assert.match(component, /OPPORTUNITY RELATIONSHIP/);
  assert.match(component, /currentOpportunity\.recommendation/);
  assert.match(component, /currentOpportunity\.status/);
  assert.match(component, /currentOpportunity\.score/);
  assert.match(component, /\/plan\?opportunity=\$\{encodeURIComponent\(currentOpportunity\.opportunityId\)\}/);
  assert.match(component, /No opportunity has been evaluated from this Signal yet/);
  assert.match(component, />Add context<\/button>/);
});

test("Opportunity relationship remains readable and keyboard reachable on narrow layouts", async () => {
  const css = await source("../components/SignalsWorkspace.module.css");
  assert.match(css, /\.opportunityRelationship\{/);
  assert.match(css, /\.opportunityRelationship>a/);
  assert.match(css, /@media\(max-width:620px\)[\s\S]*\.opportunityRelationship\{grid-template-columns:1fr\}/);
  assert.match(css, /\.page a:focus-visible/);
});
