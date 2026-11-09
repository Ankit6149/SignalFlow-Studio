import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("Signals exposes every canonical lifecycle view without inventing UI-only states", async () => {
  const component = await source("../components/SignalsWorkspace.js");
  for (const value of ["new", "interpreted_used", "snoozed", "ignored", "archived", "all"]) {
    assert.match(component, new RegExp(`<option value=["']${value}["']`));
  }
  assert.match(component, /\["new", "interpreted", "used"\]\.includes\(signal\.status\)/);
  assert.match(component, /\["interpreted", "used"\]\.includes\(signal\.status\)/);
  assert.match(component, /STATUS_LABELS\[signal\.status\]/);
});

test("Signals filters canonical history by project, source, kind and observed date", async () => {
  const component = await source("../components/SignalsWorkspace.js");
  assert.match(component, /signal\.projectId !== project/);
  assert.match(component, /signal\.sourceType !== source/);
  assert.match(component, /signal\.signalKind !== kind/);
  assert.match(component, /Date\.parse\(signal\.observedAt \|\| signal\.createdAt/);
  assert.match(component, /Last 7 days/);
  assert.match(component, /Last 30 days/);
  assert.match(component, /Older than 30 days/);
  assert.match(component, /Source · \{SOURCE_LABELS\[signal\.sourceType\]/);
  assert.doesNotMatch(component, /mockScore|fakeSource|syntheticSignal/);
});

test("Signals filter controls remain keyboard-visible and reflow on narrow screens", async () => {
  const component = await source("../components/SignalsWorkspace.js");
  const css = await source("../components/SignalsWorkspace.module.css");
  assert.match(component, /aria-label="Signal history filters"/);
  assert.match(component, /className=\{styles\.resetFilters\}/);
  assert.match(css, /\.filterBar\{display:flex;flex-wrap:wrap/);
  assert.match(css, /@media\(max-width:620px\)[\s\S]*\.filterBar\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:430px\)\{\.filterBar\{grid-template-columns:1fr\}\}/);
  assert.match(css, /\.page button:focus-visible/);
});
