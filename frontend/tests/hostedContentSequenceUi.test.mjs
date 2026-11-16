import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("hosted Plan exposes canonical ContentPiece sequence and follow-up owner action", async () => {
  const component = await source("../components/HostedCampaignPlanPanel.js");
  assert.match(component, /aria-label="Hosted content sequence"/);
  assert.match(component, /CONTENT SEQUENCE/);
  assert.match(component, />Add follow-up<\/button>/);
  assert.match(component, /application\.addHostedContentPiece\(entry, plan\.strategy/);
  assert.match(component, /purpose: pieceForm\.purpose/);
  assert.match(component, /canonicalIntent: pieceForm\.canonicalIntent/);
  assert.match(component, /timingIntent: pieceForm\.timingIntent \|\| null/);
  assert.match(component, /destinations: pieceForm\.destinations/);
  assert.match(component, /strategy\.destinationPlan\.filter\(\(item\) => item\.decision !== "exclude"\)/);
});

test("hosted sequence keeps every piece production/review panel mounted", async () => {
  const component = await source("../components/HostedCampaignPlanPanel.js");
  assert.match(component, /\(plan\.pieceBundles \|\| \[\]\)\.map\(\(\{ contentPiece: piece \}\) => \(/);
  assert.match(component, /<HostedPlatformDraftsPanel contentPiece=\{piece\} strategy=\{strategy\} \/>/);
  assert.doesNotMatch(component, /pieceBundles[^\n]*\.filter\([^\n]*activeContentPieceId/);
  assert.match(component, /function focusContentPiece\(contentPieceId\)/);
  assert.match(component, /hosted-content-piece-/);
  assert.match(component, /target\.focus\(\{ preventScroll: true \}\)/);
  assert.match(component, /tabIndex=\{-1\}/);
});

test("hosted sequence is truthful about editorial order versus scheduling", async () => {
  const component = await source("../components/HostedCampaignPlanPanel.js");
  assert.match(component, /Order is editorial intent—not a publication schedule/);
  assert.match(component, /Timing intent · not a schedule/);
  assert.match(component, /No exact publication time is implied/);
  assert.doesNotMatch(component, /scheduledAt|exactPublishAt|publishAt|calendar slot/);
});

test("hosted sequence remains keyboard-visible and responsive", async () => {
  const css = await source("../components/HostedCampaignPlanPanel.module.css");
  assert.match(css, /\.sequenceList > button\[data-active="true"\]/);
  assert.match(css, /\.pieceProduction:focus-visible/);
  assert.match(css, /\.followUpForm/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.sequenceList[\s\S]*grid-template-columns:1fr/);
  assert.match(css, /\.followUpForm input:focus-visible/);
});
