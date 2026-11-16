import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

function read(relativePath) {
  return fs.readFileSync(path.join(here, relativePath), "utf8");
}

test("GitHub connection UI surfaces the first hosted Opportunity without forcing navigation", () => {
  const source = read("../components/GithubSourceConnectionPanel.js");
  assert.match(source, /body\.firstOpportunity\?\.opportunityId/);
  assert.match(source, /setBootstrapOutcome\(\{/);
  assert.match(source, /Review opportunity/);
  assert.match(source, /Not now/);
  assert.match(source, /function openFirstOpportunity\(\)/);
  assert.match(source, /bootstrapOutcome\.opportunityId/);
  const bootstrapStart = source.indexOf("async function bootstrapRepository");
  const bootstrapEnd = source.indexOf("useEffect(", bootstrapStart);
  const bootstrapBody = source.slice(bootstrapStart, bootstrapEnd);
  assert.doesNotMatch(bootstrapBody, /window\.location\.assign\(/);
  assert.match(source, /Nothing will be approved or published until you choose it/);
  assert.doesNotMatch(source, /localStorage/);
});

test("Not now keeps durable project understanding and future GitHub reuse explicit", () => {
  const source = read("../components/GithubSourceConnectionPanel.js");
  assert.match(source, /function deferBootstrapOutcome\(\)/);
  assert.match(source, /setBootstrapOutcome\(null\)/);
  assert.match(source, /Project understanding is preserved and future meaningful GitHub work can reuse it automatically/);
  const deferStart = source.indexOf("function deferBootstrapOutcome");
  const deferEnd = source.indexOf("async function startInstallation", deferStart);
  const deferBody = source.slice(deferStart, deferEnd);
  assert.doesNotMatch(deferBody, /approve|publish|remove|revoke/i);
});

test("retryable first-Opportunity failure preserves project context without reconnecting GitHub", () => {
  const source = read("../components/GithubSourceConnectionPanel.js");
  assert.match(source, /body\.firstOpportunityStatus === "retryable_error"/);
  assert.match(source, /project context is preserved/);
  assert.match(source, /retry without reconnecting GitHub/);
});

test("repository bootstrap production composition reuses the hosted Opportunity core instead of creating a second inference workflow", () => {
  const dependencies = read("../lib/server/githubConnectionDependencies.mjs");
  const bootstrap = read("../lib/application/githubRepositoryBootstrapApplication.mjs");
  const firstOpportunity = read("../lib/application/githubRepositoryFirstOpportunityApplication.mjs");

  assert.match(dependencies, /createHostedOpportunityCore/);
  assert.match(dependencies, /createGithubRepositoryFirstOpportunityApplication/);
  assert.match(bootstrap, /firstOpportunity\.ensureInitialOpportunity/);
  assert.match(firstOpportunity, /continuation\.continueToOpportunity/);
  assert.match(firstOpportunity, /repository-context:\$\{repo\.id\}:\$\{context\.fingerprint\}/);
  assert.match(firstOpportunity, /repository_bootstrap/);
  assert.doesNotMatch(firstOpportunity, /fetch\(|\/api\/intelligence\/opportunity|openai|anthropic|gemini/i);
});
