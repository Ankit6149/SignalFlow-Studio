import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { generateVercelGateway } from "../lib/ai/providers/vercelGateway.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(testDir, "..");

function read(relative) {
  return fs.readFileSync(path.join(frontendRoot, relative), "utf8");
}

test("Vercel Gateway adapter sends bounded JSON chat completion with the supplied bearer credential", async () => {
  let request = null;
  const raw = await generateVercelGateway("Return JSON.", null, {
    apiKey: "test-gateway-credential",
    maxTokens: 321,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({
        choices: [{ message: { content: '{"ok":true}' } }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });

  assert.equal(raw, '{"ok":true}');
  assert.equal(request.url, "https://ai-gateway.vercel.sh/v1/chat/completions");
  assert.equal(request.options.headers.Authorization, "Bearer test-gateway-credential");
  const body = JSON.parse(request.options.body);
  assert.equal(body.model, "google/gemini-2.5-flash-lite");
  assert.equal(body.max_tokens, 321);
  assert.equal(body.stream, false);
  assert.deepEqual(body.response_format, { type: "json_object" });
  assert.deepEqual(body.messages, [{ role: "user", content: "Return JSON." }]);
});

test("every canonical GP2 intelligence route considers Vercel Gateway before direct provider keys", () => {
  const routes = [
    "app/api/intelligence/project-context/route.js",
    "app/api/intelligence/opportunity/route.js",
    "app/api/intelligence/strategy/route.js",
    "app/api/intelligence/platform-variant/route.js",
    "app/api/intelligence/platform-revision/route.js",
    "app/api/intelligence/critic/route.js",
  ];

  for (const route of routes) {
    const source = read(route);
    assert.match(source, /const CANDIDATE_PROVIDERS = \["vercel_gateway", "gemini"/);
    assert.match(source, /assertInferenceRouteAllowed/);
    assert.match(source, /allowServerKey: isOwner/);
  }
});

test("provider registry and generation policy expose Vercel Gateway as a real remote model route", () => {
  const providers = read("lib/ai/types.js");
  const policy = read("lib/ai/generationPolicy.mjs");
  const router = read("lib/ai/generateText.js");

  assert.match(providers, /VERCEL_OIDC_TOKEN/);
  assert.match(providers, /google\/gemini-2\.5-flash-lite/);
  assert.match(policy, /"vercel_gateway"/);
  assert.match(router, /generateVercelGateway/);
});
