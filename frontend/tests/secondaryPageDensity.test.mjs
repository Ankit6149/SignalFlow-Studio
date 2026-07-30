import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workspaceUrl = new URL("../app/app-workspace.css", import.meta.url);

test("Campaign Library uses compact management rows", async () => {
  const css = await readFile(workspaceUrl, "utf8");
  assert.match(css, /\.library-grid,[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(css, /\.library-card \{[\s\S]*min-height:\s*0[\s\S]*grid-template-areas:[\s\S]*"meta actions"[\s\S]*"preview actions"/);
  assert.match(css, /\.library-card footer \{[\s\S]*grid-area:\s*actions/);
  assert.match(css, /\.empty-library \{[\s\S]*min-height:\s*16rem/);
  assert.doesNotMatch(css, /\.library-card \{[^}]*min-height:\s*17rem/s);
});

test("Connections remain compact and width safe", async () => {
  const css = await readFile(workspaceUrl, "utf8");
  assert.match(css, /\.connections-grid \{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(css, /\.connection-card \{[\s\S]*grid-template-columns:\s*auto minmax\(0, 1fr\) minmax\(10rem, auto\)/);
  assert.match(css, /\.connection-card p \{[\s\S]*overflow-wrap:\s*anywhere/);
  assert.match(css, /@media \(max-width: 52rem\)[\s\S]*\.connection-card__actions \{[\s\S]*grid-column:\s*1 \/ -1/);
});

test("Settings remove artificial height and retain responsive actions", async () => {
  const css = await readFile(workspaceUrl, "utf8");
  assert.match(css, /\.settings-card \{[\s\S]*min-height:\s*0/);
  assert.match(css, /\.settings-card--wide \{[\s\S]*grid-column:\s*1 \/ -1/);
  assert.match(css, /@media \(max-width: 52rem\)[\s\S]*\.settings-grid \{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(css, /@media \(max-width: 52rem\)[\s\S]*\.settings-form \.button \{[\s\S]*width:\s*100%/);
  assert.doesNotMatch(css, /\.settings-card \{[^}]*min-height:\s*15rem/s);
});

test("secondary page actions expose visible keyboard focus", async () => {
  const css = await readFile(workspaceUrl, "utf8");
  assert.match(css, /\.library-card footer button:focus-visible/);
  assert.match(css, /\.connector-action:focus-visible/);
  assert.match(css, /\.settings-actions button:focus-visible/);
  assert.match(css, /\.settings-form button:focus-visible/);
  assert.match(css, /\.settings-links a:focus-visible/);
});
