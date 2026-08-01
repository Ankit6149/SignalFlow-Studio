import assert from "node:assert/strict";
import test from "node:test";

import { buildMarkdown } from "../lib/export/markdown.js";
import { projectCampaignMarkdown } from "../lib/export/campaignExport.mjs";
import { campaignInput } from "./campaignFixtures.mjs";

function occurrences(value, pattern) {
  return [...value.matchAll(pattern)].length;
}

function packageFixture(media = {}) {
  return {
    project: { name: "SignalFlow", description: "Review-first campaign studio", audience: "builders" },
    context: {},
    strategy: {},
    posts: {
      linkedin: { body: "Edited launch draft" },
      x: { posts: ["Edited thread draft"] },
    },
    media,
    publishing: {},
  };
}

test("legacy Markdown emits Screenshot Plan exactly once when present", () => {
  const markdown = buildMarkdown({
    projectName: "SignalFlow",
    package: packageFixture({ screenshotPlan: ["Capture the Review workspace"] }),
  });
  assert.equal(occurrences(markdown, /^### Screenshot Plan$/gm), 1);
  assert.equal(occurrences(markdown, /^- \[ \] Capture the Review workspace$/gm), 1);
});

test("legacy Markdown omits an empty Screenshot Plan cleanly", () => {
  const markdown = buildMarkdown({ projectName: "SignalFlow", package: packageFixture({ screenshotPlan: [] }) });
  assert.equal(occurrences(markdown, /^### Screenshot Plan$/gm), 0);
});

test("canonical Markdown is deterministic and uses current edited drafts once", () => {
  const input = campaignInput();
  const first = projectCampaignMarkdown(input).content;
  const second = projectCampaignMarkdown(input).content;
  assert.equal(first, second);
  assert.equal(occurrences(first, /^### Screenshot plan$/gm), 1);
  assert.equal(occurrences(first, /Edited LinkedIn draft — authoritative\./g), 1);
  assert.equal(occurrences(first, /Edited X draft — authoritative\./g), 1);
  assert.equal(occurrences(first, /Edited blog draft — authoritative\./g), 1);
  assert.doesNotMatch(first, /Original structured duplicate\./);
});
