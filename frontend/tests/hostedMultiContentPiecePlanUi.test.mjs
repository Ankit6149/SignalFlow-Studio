import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("hosted planning API exposes one stale-safe add_content_piece action over the canonical application", async () => {
  const route = await source("../app/api/planning/route.js");
  assert.match(route, /"add_content_piece"/);
  assert.match(route, /requireExpectedRevision\(body, current\.strategy\)/);
  assert.match(route, /planningApplication\.addContentPiece\(strategyId/);
  assert.match(route, /purpose: String\(body\.purpose/);
  assert.match(route, /canonicalIntent: String\(body\.canonicalIntent/);
  assert.match(route, /timingIntent: String\(body\.timingIntent/);
  assert.match(route, /destinations,/);
  assert.doesNotMatch(route, /scheduledAt|exactPublishAt|publishAt|PublicationRequest/);
});

test("hosted planning browser client preserves canonical multi-piece bundles and sends exact strategy revision", async () => {
  const client = await source("../lib/infrastructure/browserHostedPlanningClient.mjs");
  assert.match(client, /contentPieces: Object\.freeze\(contentPieces\)/);
  assert.match(client, /pieceBundles: Object\.freeze\(pieceBundles\)/);
  assert.match(client, /action: "add_content_piece"/);
  assert.match(client, /expectedStrategyRevision: current\.strategyRevision/);
  assert.match(client, /normalizeContentPiece\(bundle\.contentPiece\)/);
  assert.match(client, /bundle\.variants\.map\(normalizePlatformVariant\)/);
});

test("Plan application keeps connected-source follow-up creation on hosted persistence", async () => {
  const app = await source("../lib/application/browserPlanOpportunityApplication.mjs");
  assert.match(app, /async function addHostedContentPiece\(entryInput, strategy, input = \{\}\)/);
  assert.match(app, /const entry = requireHostedEntry\(entryInput\)/);
  assert.match(app, /hostedPlanning\.addContentPiece\(entry\.opportunity\.opportunityId, strategy, input\)/);
  assert.match(app, /addHostedContentPiece,/);
});

test("hosted Plan shows every canonical ContentPiece and creates follow-ups without UI-local records", async () => {
  const component = await source("../components/HostedCampaignPlanPanel.js");
  assert.match(component, /aria-label="Hosted content sequence"/);
  assert.match(component, /CONTENT SEQUENCE/);
  assert.match(component, /Add follow-up/);
  assert.match(component, /application\.addHostedContentPiece\(entry, plan\.strategy, pieceForm\)/);
  assert.match(component, /plan\?\.pieceBundles\?\.length/);
  assert.match(component, /pieceBundles\.map\(\(\{ contentPiece \}, index\) =>/);
  assert.match(component, /<HostedPlatformDraftsPanel contentPiece=\{contentPiece\} strategy=\{strategy\}/);
  assert.match(component, /\(plan\?\.strategy\?\.destinationPlan \|\| \[\]\)\.filter\(\(item\) => item\.decision !== "exclude"\)/);
});

test("hosted content sequence remains editorial-only, focus-safe and narrow-screen friendly", async () => {
  const component = await source("../components/HostedCampaignPlanPanel.js");
  const css = await source("../components/HostedCampaignPlanPanel.module.css");
  assert.match(component, /Order and timing intent are editorial planning only—not a publication schedule/);
  assert.match(component, /TIMING INTENT · NOT A SCHEDULE/);
  assert.match(component, /No exact timing set/);
  assert.match(component, /target\.focus\(\{ preventScroll: true \}\)/);
  assert.match(component, /tabIndex=\{-1\}/);
  assert.doesNotMatch(component, /scheduledAt|exactPublishAt|publishAt|calendar slot/);
  assert.match(css, /\.productionPiece:focus-visible/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.sequenceList[\s\S]*grid-template-columns: 1fr/);
});
