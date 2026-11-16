import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

function read(relativePath) {
  return fs.readFileSync(path.join(here, relativePath), "utf8");
}

test("GitHub connection UI surfaces the first hosted Opportunity without forcing navigation", () => {\n  const source = read("../components/GithubSourceConnectionPanel.js");\n  assert.match(source, /body\.firstOpportunity\?\.opportunityId/);\n  assert.match(source, /setBootstrapOutcome\(\{/);\n  assert.match(source, /Review opportunity/);\n  assert.match(source, /Not now/);\n  assert.match(source, /function openFirstOpportunity\(\)/);\n  assert.match(source, /bootstrapOutcome\.opportunityId/);\n  const bootstrapStart = source.indexOf("async function bootstrapRepository");\n  const bootstrapEnd = source.indexOf("useEffect(", bootstrapStart);\n  const bootstrapBody = source.slice(bootstrapStart, bootstrapEnd);\n  assert.doesNotMatch(bootstrapBody, /window\.location\.assign\(/);\n  assert.match(source, /Nothing will be approved or published until you choose it/);\n  assert.doesNotMatch(source, /localStorage/);\n});\n\ntest("Not now keeps durable project understanding and future GitHub reuse explicit", () => {\n  const source = read("../components/GithubSourceConnectionPanel.js");\n  assert.match(source, /function deferBootstrapOutcome\(\)/);\n  assert.match(source, /setBootstrapOutcome\(null\)/);\n  assert.match(source, /Project understanding is preserved and future meaningful GitHub work can reuse it automatically/);\n  const deferStart = source.indexOf("function deferBootstrapOutcome");\n  const deferEnd = source.indexOf("async function startInstallation", deferStart);\n  const deferBody = source.slice(deferStart, deferEnd);\n  assert.doesNotMatch(deferBody, /approve|publish|remove|revoke/i);\n});\n\ntest("retryable first-Opportunity failure preserves project context without reconnecting GitHub", () => {\n  const source = read("../components/GithubSourceConnectionPanel.js");\n  assert.match(source, /body\.firstOpportunityStatus === "retryable_error"/);\n  assert.match(source, /project context is preserved/);\n  assert.match(source, /retry without reconnecting GitHub/);\n});

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
