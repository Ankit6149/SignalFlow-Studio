import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("all current public-link entry paths converge on the hardened server boundary", async () => {
  const wrapper = await source("../lib/context/linkFetcher.js");
  const linkRoute = await source("../app/api/context/links/route.js");
  const generationRoute = await source("../app/api/launch_kit/route.js");
  const preparation = await source("../lib/source/generationSourcePreparation.mjs");
  const mcp = await source("../../mcp/lib/tools.mjs");

  assert.match(wrapper, /createRemoteSourceFetcher/);
  assert.doesNotMatch(wrapper, /\bfetch\s*\(/);

  assert.match(linkRoute, /fetchUrlContent\(url, \{ signal: request\.signal \}\)/);
  assert.match(linkRoute, /Cache-Control": "private, no-store, max-age=0"/);

  assert.match(generationRoute, /prepareRemoteLinkEvidence\(/);
  const fetchIndex = preparation.indexOf("await fetchUrlContentImpl(candidate.canonicalUrl");
  const usableIndex = preparation.indexOf("fetchResult.evidenceUsable === true", fetchIndex);
  const promptIndex = preparation.indexOf("linksContext.push(fetchResult)", usableIndex);
  assert.ok(fetchIndex >= 0);
  assert.ok(usableIndex > fetchIndex);
  assert.ok(promptIndex > usableIndex, "generation may only receive remote text after the hardened result is usable evidence");
  assert.match(preparation, /sourceArtifactFromFetchResult/);
  assert.match(preparation, /validateSourceGraph\(\{[\s\S]*sourceArtifacts: \[\.\.\.nextSources\.sourceArtifacts, remoteArtifact\]/);

  assert.match(mcp, /docs_url: String\(args\.links \|\| ""\)\.trim\(\)/);
  assert.match(mcp, /signalFlowRequest\("\/api\/launch_kit"/);
});

test("capability and public documentation advertise exactly the hardened public-text scope", async () => {
  const capabilities = await source("../app/api/capabilities/route.js");
  const matrix = await source("../../docs/CAPABILITY_MATRIX.md");
  const readme = await source("../../README.md");
  const sourceContract = await source("../../docs/SOURCE_ASSET_CONTRACT.md");
  const llms = await source("../../llms-full.txt");
  const publicLlms = await source("../public/llms-full.txt");

  assert.match(capabilities, /sourceCapabilities: \{[\s\S]*hardenedRemoteFetch: true/);
  assert.match(matrix, /Hardened remote URL evidence fetch \(#127\).*Available/);
  assert.match(readme, /fail-closed hardened public-text URL fetch boundary/i);
  assert.doesNotMatch(readme, /Still incomplete[\s\S]{0,200}hardened remote URL ingestion across all source paths/i);
  assert.match(sourceContract, /DNS pinning/);
  assert.match(sourceContract, /Authenticated\/private-site fetching/);
  assert.equal(llms, publicLlms);
  assert.match(llms, /Supported public text\/HTML fetches pin a vetted DNS answer into the actual request/);
  assert.match(llms, /Authenticated private-site ingestion/);
});

test("the hardened boundary has no environment escape hatch for private destinations", async () => {
  const fetcher = await source("../lib/context/remoteSourceFetcher.mjs");
  assert.doesNotMatch(fetcher, /SIGNALFLOW_ALLOW_PRIVATE_FETCHES|forceHostedSafety|hostedSafetyRequired/);
  assert.match(fetcher, /unsafe_dns_answer/);
  assert.match(fetcher, /private_address_blocked/);
  assert.match(fetcher, /credential_query_forbidden/);
  assert.match(fetcher, /redirect_loop/);
  assert.match(fetcher, /compressed_size_exceeded/);
  assert.match(fetcher, /decompressed_size_exceeded/);
  assert.match(fetcher, /unsupported_mime_type/);
  assert.match(fetcher, /malformed_text_encoding/);
});
