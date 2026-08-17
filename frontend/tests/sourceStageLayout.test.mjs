import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const decisionUrl = new URL("../app/studio-decision-flow.css", import.meta.url);
const productUrl = new URL("../app/studio-product.css", import.meta.url);

test("Source defaults to one readable column and widens only when there is room", async () => {
  const css = await readFile(decisionUrl, "utf8");
  assert.match(css, /data-stage="source"\] \.composer-panel[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\);/);
  assert.match(css, /grid-template-areas:[\s\S]*"header"[\s\S]*"identity"[\s\S]*"brief"[\s\S]*"evidence"[\s\S]*"upload"[\s\S]*"files"/);
  assert.match(css, /@media \(min-width: 84rem\)[\s\S]*"header header"[\s\S]*"identity evidence"[\s\S]*"brief evidence"[\s\S]*"brief upload"[\s\S]*"brief files"/);
});

test("Source evidence and attached files remain width safe without nested scroll areas", async () => {
  const [decision, product] = await Promise.all([
    readFile(decisionUrl, "utf8"),
    readFile(productUrl, "utf8"),
  ]);
  assert.match(decision, /data-stage="source"\] \.source-grid \{[\s\S]*min-width:\s*0/);
  assert.match(decision, /data-stage="source"\] \.source-grid \{[\s\S]*border-top:\s*0\.0625rem solid var\(--app-line\)/);
  assert.match(product, /\.file-list \{[\s\S]*display:\s*grid/);
  assert.match(product, /\.file-chip \{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) auto auto/);
  assert.match(product, /\.file-chip span \{[\s\S]*text-overflow:\s*ellipsis/);
  assert.doesNotMatch(decision, /data-stage="source"\][\s\S]*overflow-y:\s*(auto|scroll)/);
});

test("Source upload and remove controls expose visible keyboard focus", async () => {
  const css = await readFile(productUrl, "utf8");
  assert.match(css, /\.upload-zone:focus-visible/);
  assert.match(css, /\.file-chip button:focus-visible/);
});
