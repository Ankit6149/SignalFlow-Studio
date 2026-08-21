import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

function read(relativePath) {
  return fs.readFileSync(path.join(here, relativePath), "utf8");
}

test("GitHub connection UI opens the exact hosted first Opportunity and preserves context on retryable Opportunity failure", () => {
  const source = read("../components/GithubSourceConnectionPanel.js");
  assert.match(source, /body\.firstOpportunity\?\.opportunityId/);
  assert.match(source, /\/plan\?opportunity=\$\{encodeURIComponent\(body\.firstOpportunity\.opportunityId\)\}&from=github/);
  assert.match(source, /body\.firstOpportunityStatus === "retryable_error"/);
  assert.match(source, /project context is preserved/);
  assert.match(source, /retry without reconnecting GitHub/);
  assert.doesNotMatch(source, /localStorage/);
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
