import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowUrl = new URL("../app/studio-product.css", import.meta.url);

test("Source uses explicit desktop and mobile reading areas", async () => {
  const css = await readFile(workflowUrl, "utf8");
  assert.match(css, /grid-template-areas:[\s\S]*"header header"[\s\S]*"identity evidence"[\s\S]*"brief evidence"[\s\S]*"brief upload"[\s\S]*"brief files"/);
  assert.match(css, /@media \(max-width: 68rem\)[\s\S]*grid-template-areas:[\s\S]*"header"[\s\S]*"identity"[\s\S]*"brief"[\s\S]*"evidence"[\s\S]*"upload"[\s\S]*"files"/);
  assert.doesNotMatch(css, /grid-row:\s*2 \/ span 2/);
});

test("Source evidence and attached files remain width safe", async () => {
  const css = await readFile(workflowUrl, "utf8");
  assert.match(css, /\.source-grid \{[\s\S]*min-width:\s*0/);
  assert.match(css, /\.file-list \{[\s\S]*display:\s*grid/);
  assert.match(css, /\.file-chip \{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) auto auto/);
  assert.match(css, /\.file-chip span \{[\s\S]*text-overflow:\s*ellipsis/);
  assert.doesNotMatch(css, /\.studio-page\[data-stage="source"\][\s\S]*overflow-y:\s*(auto|scroll)/);
  assert.doesNotMatch(css, /\.studio-page\[data-stage="source"\] \.file-list \{[\s\S]*max-height:/);
});

test("Source upload and remove controls expose visible keyboard focus", async () => {
  const css = await readFile(workflowUrl, "utf8");
  assert.match(css, /\.upload-zone:focus-visible/);
  assert.match(css, /\.file-chip button:focus-visible/);
});
