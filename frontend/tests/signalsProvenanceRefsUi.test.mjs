import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("Signal detail exposes canonical source, event, artifact and asset references without inference", async () => {
  const component = await source("../components/SignalsWorkspace.js");
  assert.match(component, /function SignalProvenanceDetails\(\{ signal \}\)/);
  assert.match(component, /signal\.sourceConnectionId/);
  assert.match(component, /signal\.sourceRevision/);
  assert.match(component, /signal\.externalEventRef/);
  assert.match(component, /eventRef\.provider/);
  assert.match(component, /eventRef\.eventId/);
  assert.match(component, /eventRef\.idempotencyKey/);
  assert.match(component, /signal\.sourceArtifactIds\.map/);
  assert.match(component, /signal\.assetIds\.map/);
  assert.match(component, /signal\.provenance\?\.ingestionMethod/);
  assert.match(component, /signal\.provenance\?\.capturedAt/);
  assert.doesNotMatch(component, /sourceArtifactIds.*https?:|assetIds.*https?:/);
});

test("Signal provenance is a compact disclosure and does not hide missing-reference truth", async () => {
  const component = await source("../components/SignalsWorkspace.js");
  assert.match(component, /<details className=\{styles\.provenanceDetails\}>/);
  assert.match(component, /<summary>Source \+ assets/);
  assert.match(component, /no attached references/);
  assert.match(component, /This Signal has no connected source, artifact, event, or asset references attached/);
  assert.match(component, /<SignalProvenanceDetails signal=\{signal\} \/>/);
});

test("Signal provenance references wrap, reflow and keep summary keyboard-visible", async () => {
  const css = await source("../components/SignalsWorkspace.module.css");
  assert.match(css, /\.referenceValue,\.referenceList code\{overflow-wrap:anywhere;word-break:break-word\}/);
  assert.match(css, /\.page summary:focus-visible/);
  assert.match(css, /@media\(max-width:620px\)[\s\S]*\.provenanceGrid\{grid-template-columns:1fr\}/);
  assert.match(css, /font-family:ui-monospace/);
});
