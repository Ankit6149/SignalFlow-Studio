import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createBrowserHostedGp2PreparationClient } from "../lib/infrastructure/browserHostedGp2PreparationClient.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function source(...parts) {
  return fs.readFileSync(path.join(ROOT, ...parts), "utf8");
}

test("hosted GP2 resume client is same-origin, no-store and sends only canonical content-piece identity", async () => {
  const calls = [];
  const client = createBrowserHostedGp2PreparationClient({
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({
        ok: true,
        preparation: {
          status: "ready_for_judgment",
          contentPieceId: "piece-1",
          nextRoute: "/today",
          failures: [],
        },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  const result = await client.prepareContentPiece("piece-1");
  assert.equal(result.status, "ready_for_judgment");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/gp2/preparation");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.credentials, "same-origin");
  assert.equal(calls[0].options.cache, "no-store");
  assert.deepEqual(JSON.parse(calls[0].options.body), { contentPieceId: "piece-1" });
});

test("hosted GP2 resume endpoint is owner-locked and reuses the production preparation composition", () => {
  const route = source("app", "api", "gp2", "preparation", "route.js");
  assert.match(route, /requireOwnerAccess\(request\)/);
  assert.match(route, /createProductionHostedGp2PreparationApplication/);
  assert.match(route, /prepareContentPiece\(contentPieceId\)/);
  assert.match(route, /cache-control": "private, no-store, max-age=0"/);
  assert.doesNotMatch(route, /SIGNALFLOW_ACCESS_KEY|DATABASE_URL|objectKey|storageRef|signedUrl/);
});

test("approved hosted Plan automatically resumes preparation and leaves only recovery controls", () => {
  const drafts = source("components", "HostedPlatformDraftsPanel.js");
  assert.match(drafts, /createBrowserHostedGp2PreparationClient/);
  assert.match(drafts, /preparationClient\.prepareContentPiece\(contentPieceId\)/);
  assert.match(drafts, /Automatic preparation is complete/);
  assert.match(drafts, /Retry visual proof/);
  assert.match(drafts, /Retry available drafts/);
  assert.match(drafts, /Retry \$\{pending\} draft/);
  assert.doesNotMatch(drafts, />Prepare visual proof</);
  assert.doesNotMatch(drafts, />Generate available drafts</);
});
