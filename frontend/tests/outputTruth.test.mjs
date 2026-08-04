import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  assessChannelDraft,
  buildChannelPrompt,
  hasVerifiedTimelineEvidence,
} from "../lib/ai/channelGeneration.mjs";

const campaignBrief = {
  project: {
    name: "SignalFlow Studio",
    description: "A review-first campaign workspace.",
    audience: "founders and product teams",
  },
  context: {
    confirmedFacts: ["SignalFlow Studio creates reviewable destination drafts."],
    inferredFacts: [],
    missingContext: [],
    features: ["Review-first generation"],
    techStack: ["Next.js"],
  },
  strategy: {
    coreAngle: "Product evidence before public copy.",
    positioning: "A truthful campaign workflow.",
    destinationAngles: { youtube: "A product walkthrough" },
  },
};

function context(mediaItems = []) {
  return {
    projectName: "SignalFlow Studio",
    audience: "founders and product teams",
    notes: "Explain the product workflow without inventing duration or capabilities.",
    confirmedFacts: ["SignalFlow Studio creates reviewable destination drafts."],
    inferredFacts: [],
    missingContext: [],
    features: ["Review-first generation"],
    techStack: ["Next.js"],
    selectedChannels: ["youtube"],
    mediaItems,
  };
}

function youtubeDescription({ timestamp = false } = {}) {
  const chapter = timestamp ? "00:00 Product context" : "Product context";
  return [
    "SignalFlow Studio walkthrough",
    chapter,
    "Source evidence",
    "Campaign strategy",
    "Destination review",
    "Export and manual handoff",
    ...Array.from({ length: 85 }, (_, index) =>
      `SignalFlow Studio keeps product evidence, editorial decisions, limitations, and review state connected so viewers can understand the workflow without unsupported claims in section ${index + 1}.`,
    ),
  ].join("\n\n");
}

test("timeline evidence requires verified video duration or a supplied timeline", () => {
  assert.equal(hasVerifiedTimelineEvidence(context()), false);
  assert.equal(hasVerifiedTimelineEvidence(context([
    { type: "screen recording", durationSeconds: 145 },
  ])), false);
  assert.equal(hasVerifiedTimelineEvidence(context([
    { type: "screen recording", durationSeconds: 145, durationVerified: true },
  ])), true);
  assert.equal(hasVerifiedTimelineEvidence(context([
    { type: "video", chapters: [{ start: 0, title: "Overview" }] },
  ])), true);
});

test("YouTube prompt uses untimed sections when no timeline evidence exists", () => {
  const prompt = buildChannelPrompt({
    channel: "youtube",
    context: context(),
    campaignBrief,
  });

  assert.match(prompt, /NO VERIFIED TIMELINE EVIDENCE IS AVAILABLE/i);
  assert.match(prompt, /untimed chapter\/segment plan/i);
  assert.match(prompt, /do not fabricate timestamps or duration/i);
});

test("YouTube prompt requests timestamps only with verified timeline evidence", () => {
  const prompt = buildChannelPrompt({
    channel: "youtube",
    context: context([
      { type: "screen recording", durationSeconds: 145, durationVerified: true },
    ]),
    campaignBrief,
  });

  assert.match(prompt, /VERIFIED TIMELINE EVIDENCE IS AVAILABLE/i);
  assert.match(prompt, /accurate timestamped chapters/i);
});

test("YouTube quality gate rejects invented timestamps without evidence", () => {
  const result = assessChannelDraft("youtube", {
    title: "SignalFlow Studio product walkthrough",
    description: youtubeDescription({ timestamp: true }),
    tags: ["signalflow", "campaign workflow"],
  }, {
    projectName: "SignalFlow Studio",
    sourceContext: context(),
  });

  assert.ok(result.issues.some((issue) => /without verified duration or timeline evidence/i.test(issue)));
  assert.equal(result.metrics.requiresTimedChapters, false);
});

test("YouTube quality gate requires timestamps when verified timeline evidence exists", () => {
  const result = assessChannelDraft("youtube", {
    title: "SignalFlow Studio product walkthrough",
    description: youtubeDescription(),
    tags: ["signalflow", "campaign workflow"],
  }, {
    projectName: "SignalFlow Studio",
    sourceContext: context([
      { type: "screen recording", durationSeconds: 145, durationVerified: true },
    ]),
  });

  assert.ok(result.issues.some((issue) => /despite verified timeline evidence/i.test(issue)));
  assert.equal(result.metrics.requiresTimedChapters, true);
});

test("Hacker News status uses the canonical active identifier", async () => {
  const route = await readFile(new URL("../app/api/social/status/route.js", import.meta.url), "utf8");
  assert.match(route, /result\.hackernews\s*=/);
  assert.match(route, /id:\s*"hackernews"/);
  assert.doesNotMatch(route, /result\.hn\s*=/);
  assert.doesNotMatch(route, /id:\s*"hn"/);
});
