import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("Studio, API and generation controller consume the same SourceHealthReport contract", async () => {
  const page = await source("../app/StudioRootController.js");
  const destinations = await source("../components/DestinationsStage.js");
  const sourceStage = await source("../components/SourceStage.js");
  const controller = await source("../lib/studio/useCampaignGenerationController.js");
  const route = await source("../app/api/launch_kit/route.js");

  assert.match(page, /createSourceHealthReport/);
  assert.match(page, /parseSourceLinkCandidates\(form\.links\)/);
  assert.match(page, /sourceHealth\.counts\.usable \+ sourceHealth\.counts\.needsVerification/);
  assert.match(page, /sourceHealth=\{sourceHealth\}/);
  assert.doesNotMatch(page, /form\.links\.trim\(\),\s*form\.repo\.trim\(\),\s*\.\.\.documentText/);

  assert.match(sourceStage, /will be verified securely before generation/);
  assert.match(destinations, /Verify on build/);
  assert.match(destinations, /before any model call/);

  assert.match(controller, /createSourceHealthReport/);
  assert.match(controller, /sourceHealth\.status === SOURCE_HEALTH_STATUSES\.BLOCKED/);

  const validationIndex = route.indexOf("validateGenerationInputs(body)");
  const fetchIndex = route.indexOf("await fetchUrlContent(candidate.canonicalUrl");
  const finalHealthIndex = route.indexOf("const sourceHealth = createSourceHealthReport", fetchIndex);
  const finalGateIndex = route.indexOf('code: "source_not_ready"', finalHealthIndex);
  const streamIndex = route.indexOf("return streamGeneration({", finalGateIndex);
  const modelIndex = route.indexOf("const result = await generateStudioPackage({", finalGateIndex);
  assert.ok(validationIndex >= 0);
  assert.ok(fetchIndex > validationIndex);
  assert.ok(finalHealthIndex > fetchIndex);
  assert.ok(finalGateIndex > finalHealthIndex);
  assert.ok(streamIndex > finalGateIndex);
  assert.ok(modelIndex > finalGateIndex);
});

test("launch kit reports source health in validation failures, blocked verification, streaming and JSON success", async () => {
  const route = await source("../app/api/launch_kit/route.js");
  assert.match(route, /sourceHealth: validation\.sourceHealth/);
  assert.match(route, /code: "source_not_ready"/);
  assert.match(route, /status: 422/);
  assert.match(route, /streamGeneration\(\{ generationInput, generationConfig, warnings, sourceHealth \}\)/);
  assert.match(route, /data: \{ \.\.\.result, warnings: allWarnings, sourceHealth \}/);
  assert.match(route, /JSON\.stringify\(\{ \.\.\.result, warnings: allWarnings, sourceHealth \}\)/);
});

test("remote candidates are deduplicated before the hardened fetcher and all outcomes remain in source health", async () => {
  const route = await source("../app/api/launch_kit/route.js");
  assert.match(route, /parseSourceLinkCandidates\(docsUrl\)/);
  assert.match(route, /linkCandidates\.filter\(\(item\) => item\.status === SOURCE_HEALTH_ENTRY_STATUSES\.NEEDS_VERIFICATION\)/);
  assert.match(route, /linkFetchResults\.push\(fetchResult\)/);
  assert.match(route, /linkResults: docsUrl \? linkFetchResults : null/);
});

test("MCP validation exposes the same source-health state and actual generation delegates to the same launch-kit gate", async () => {
  const mcp = await source("../../mcp/lib/tools.mjs");
  assert.match(mcp, /const sourceHealth = validation\.sourceHealth \|\| null/);
  assert.match(mcp, /sourceHealth,/);
  assert.match(mcp, /sourceHealth\?\.status === "needs_verification"/);
  assert.match(mcp, /docs_url: String\(args\.links \|\| ""\)\.trim\(\)/);
  assert.match(mcp, /signalFlowRequest\("\/api\/launch_kit"/);
});

test("source health remains a bounded readiness report, not the future source-health workspace", async () => {
  const contract = await source("../lib/source/sourceHealth.mjs");
  assert.match(contract, /SOURCE_HEALTH_REPORT_VERSION = 1/);
  assert.match(contract, /READY: "ready"/);
  assert.match(contract, /NEEDS_VERIFICATION: "needs_verification"/);
  assert.match(contract, /BLOCKED: "blocked"/);
  assert.doesNotMatch(contract, /fetch\s*\(|localStorage|database|SourceHealthWorkspace/);
});
