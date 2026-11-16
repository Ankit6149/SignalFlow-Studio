import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("Plan exposes canonical ordered ContentPieces and an explicit follow-up creation path", async () => {
  const component = await source("../components/CampaignPlanPanel.js");
  assert.match(component, /aria-label="Content sequence"/);
  assert.match(component, /CONTENT SEQUENCE/);
  assert.match(component, />Add follow-up<\/button>/);
  assert.match(component, /application\.addContentPiece\(bundle\.strategy\.narrativeStrategyId/);
  assert.match(component, /purpose: pieceForm\.purpose/);
  assert.match(component, /canonicalIntent: pieceForm\.canonicalIntent/);
  assert.match(component, /timingIntent: pieceForm\.timingIntent \|\| null/);
  assert.match(component, /destinations: pieceForm\.destinations/);
  assert.match(component, /strategy\.destinationPlan\.filter\(\(item\) => item\.decision !== "exclude"\)/);
});

test("content sequence language stays editorial and never pretends timing intent is a publication schedule", async () => {
  const component = await source("../components/CampaignPlanPanel.js");
  assert.match(component, /Order is editorial intent—not a publication schedule/);
  assert.match(component, /Timing intent · not a schedule/);
  assert.match(component, /No exact timing set/);
  assert.doesNotMatch(component, /scheduledAt|exactPublishAt|publishAt|calendar slot/);
});

test("each ContentPiece gets independent generation and exact Review state", async () => {
  const component = await source("../components/CampaignPlanPanel.js");
  assert.match(component, /generationBundles/);
  assert.match(component, /generationApplication\.getGenerationBundle\(piece\.contentPieceId\)/);
  assert.match(component, /generationApplication\.generateReadyVariants\(piece\.contentPieceId\)/);
  assert.match(component, /setGenerationBundles\(\(current\) => \(\{ \.\.\.current, \[piece\.contentPieceId\]: result\.bundle \}\)\)/);
  assert.match(component, /function ContentPieceProduction/);
  assert.match(component, /<PlatformReviewPanel variant=\{variant\} revision=\{currentRevision\}/);
  assert.match(component, /do not mutate another ContentPiece/);
});

test("sequence navigation keeps every ContentPiece review section mounted", async () => {
  const component = await source("../components/CampaignPlanPanel.js");
  assert.match(component, /pieceBundles\.map\(\(pieceBundle\) => \(/);
  assert.match(component, /<ContentPieceProduction/);
  assert.doesNotMatch(component, /pieceBundles\.filter\([^\n]*activeContentPiece/);
  assert.match(component, /function focusContentPiece\(contentPieceId\)/);
  assert.match(component, /document\.getElementById\(\`content-piece-\$\{contentPieceId\}\`\)/);
  assert.match(component, /target\.focus\(\{ preventScroll: true \}\)/);
  assert.match(component, /tabIndex=\{-1\}/);
});

test("content sequence remains keyboard-visible and single-column friendly on narrow screens", async () => {
  const css = await source("../components/CampaignPlanPanel.module.css");
  assert.match(css, /\.sequenceList/);
  assert.match(css, /\.sequenceList > button\[data-active="true"\]/);
  assert.match(css, /\.productionStage:focus-visible/);
  assert.match(css, /\.followUpForm/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.sequenceList[\s\S]*grid-template-columns:1fr/);
});
