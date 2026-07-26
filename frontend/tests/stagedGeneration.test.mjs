import test from "node:test";
import assert from "node:assert/strict";

import {
  assessChannelDraft,
  buildChannelPrompt,
  canonicalChannel,
} from "../lib/ai/channelGeneration.mjs";
import { resolveOutputTokenBudget } from "../lib/ai/outputBudget.mjs";
import { buildCampaignBriefPrompt } from "../lib/prompt/buildCampaignBriefPrompt.mjs";

const context = {
  projectName: "SignalFlow Studio",
  audience: "founders and product teams",
  notes: "SignalFlow turns product evidence into destination-specific campaign drafts and keeps review before publishing.",
  confirmedFacts: ["SignalFlow accepts product notes and repository context."],
  inferredFacts: [],
  missingContext: ["No customer metrics were supplied."],
  features: ["Repository context", "Editable drafts", "Review-first workflow"],
  techStack: ["Next.js"],
  selectedChannels: ["linkedin", "blog"],
};

const campaignBrief = {
  project: {
    name: "SignalFlow Studio",
    description: "A campaign workspace that turns product evidence into destination-specific drafts.",
    audience: "founders and product teams",
  },
  context: {
    confirmedFacts: context.confirmedFacts,
    inferredFacts: [],
    missingContext: context.missingContext,
    features: context.features,
    techStack: context.techStack,
  },
  strategy: {
    coreAngle: "Shipping a product and explaining it are different jobs.",
    positioning: "Evidence-grounded campaign creation with review before action.",
    destinationAngles: {
      linkedin: "Founder decision and trade-off",
      blog: "Detailed explanation of the product and workflow",
    },
  },
};

test("campaign brief stage excludes public-copy generation", () => {
  const prompt = buildCampaignBriefPrompt(context);
  assert.match(prompt, /Do not write social posts, a newsletter, a blog/i);
  assert.match(prompt, /destinationAngles/);
  assert.doesNotMatch(prompt, /"posts"\s*:/);
});

test("blog prompt has a dedicated long-form contract", () => {
  const prompt = buildChannelPrompt({ channel: "blog", context, campaignBrief });
  assert.match(prompt, /1200-2500 word Markdown article/i);
  assert.match(prompt, /6-10 substantial sections/i);
  assert.match(prompt, /one specialised destination stage/i);
  assert.doesNotMatch(prompt, /complete every platform object/i);
});

test("short blog draft fails depth and structure checks", () => {
  const result = assessChannelDraft("blog", {
    title: "Why SignalFlow Studio exists",
    outline: ["Problem", "Solution"],
    draft: "SignalFlow Studio helps teams prepare campaign drafts.",
  }, { projectName: "SignalFlow Studio" });

  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.includes("too short")));
  assert.ok(result.issues.some((issue) => issue.includes("outline")));
  assert.ok(result.issues.some((issue) => issue.includes("H2")));
});

test("substantial structured blog passes the deterministic quality gate", () => {
  const headings = [
    "The communication gap after shipping",
    "What product evidence changes",
    "How SignalFlow Studio builds context",
    "Why each destination needs its own draft",
    "Review and factual boundaries",
    "Trade-offs and next steps",
  ];
  const paragraphs = Array.from({ length: 105 }, (_, index) =>
    `SignalFlow Studio keeps product facts connected to editorial decisions so a team can explain one concrete workflow, limitation, or design choice without replacing evidence with unsupported claims in section ${index + 1}.`
  );
  const sections = headings.map((heading, index) => [
    `## ${heading}`,
    ...paragraphs.slice(index * 17, index === headings.length - 1 ? paragraphs.length : (index + 1) * 17),
  ].join("\n\n"));

  const result = assessChannelDraft("blog", {
    title: "Why shipping the product does not finish the story",
    outline: headings,
    draft: sections.join("\n\n"),
  }, { projectName: "SignalFlow Studio" });

  assert.equal(result.valid, true, result.issues.join("\n"));
  assert.ok(result.metrics.words >= 1150);
});

test("X contract rejects oversized posts", () => {
  const result = assessChannelDraft("x", {
    mode: "thread",
    posts: [
      "SignalFlow Studio starts with the product evidence.",
      "It separates strategy from destination writing.",
      "Every channel receives its own editorial contract.",
      `SignalFlow Studio ${"keeps this sentence intentionally long ".repeat(12)}`,
    ],
  }, { projectName: "SignalFlow Studio" });

  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.includes("280 characters")));
});

test("long-form prompts receive larger output budgets", () => {
  assert.equal(resolveOutputTokenBudget("Write a 1200-2500 word Markdown article"), 6500);
  assert.equal(resolveOutputTokenBudget("Write a 500-1000 word newsletter"), 3600);
  assert.equal(resolveOutputTokenBudget("Create 4-8 complete posts"), 1800);
  assert.equal(resolveOutputTokenBudget("anything", 2400), 2400);
});

test("destination aliases resolve consistently", () => {
  assert.equal(canonicalChannel("hn"), "hackernews");
  assert.equal(canonicalChannel("releaseNotes"), "release_notes");
});
