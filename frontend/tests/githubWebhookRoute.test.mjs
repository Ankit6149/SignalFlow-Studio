import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createGithubWebhookHandler } from "../lib/server/githubWebhookRoute.mjs";

function signedRequest({ secret, payload, event = "pull_request", delivery = "delivery-1", signatureBody = null } = {}) {
  const raw = Buffer.from(typeof payload === "string" ? payload : JSON.stringify(payload), "utf8");
  const signed = signatureBody === null ? raw : Buffer.from(signatureBody, "utf8");
  const signature = createHmac("sha256", secret).update(signed).digest("hex");
  return new Request("https://signalflow.invalid/api/sources/github/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-github-event": event,
      "x-github-delivery": delivery,
      "x-hub-signature-256": `sha256=${signature}`,
    },
    body: raw,
  });
}

async function responseJson(response) {
  return JSON.parse(await response.text());
}

test("webhook verifies raw bytes before parsing JSON or creating database-backed ingestion", async () => {
  const secret = "webhook-secret";
  let factoryCalls = 0;
  let ingestCalls = 0;
  const handler = createGithubWebhookHandler({
    webhookSecret: secret,
    createIngestionApplication: async () => {
      factoryCalls += 1;
      return {
        async ingest() {
          ingestCalls += 1;
          return { status: "created", signal: { signalId: "signal-1" }, shouldEvaluateOpportunity: true };
        },
      };
    },
  });

  const invalidSignature = await handler(signedRequest({
    secret,
    payload: { action: "closed" },
    signatureBody: '{"action":"different"}',
  }));
  assert.equal(invalidSignature.status, 401);
  assert.equal(factoryCalls, 0);
  assert.equal(ingestCalls, 0);

  const signedInvalidJson = await handler(signedRequest({ secret, payload: "{not-json" }));
  assert.equal(signedInvalidJson.status, 400);
  assert.equal(factoryCalls, 0, "valid signature does not create storage dependencies before JSON is parsed");
  assert.equal(ingestCalls, 0);
});

test("valid webhook reaches ingestion exactly once and returns only bounded acknowledgement metadata", async () => {
  const secret = "webhook-secret";
  const calls = [];
  const handler = createGithubWebhookHandler({
    webhookSecret: secret,
    createIngestionApplication: async () => ({
      async ingest(input) {
        calls.push(input);
        return {
          status: "created",
          signal: { signalId: "signal-safe", headline: "do-not-echo" },
          shouldEvaluateOpportunity: true,
        };
      },
    }),
  });
  const payload = { action: "closed", privateBody: "must-not-return" };
  const response = await handler(signedRequest({ secret, payload, delivery: "delivery-safe" }));
  const body = await responseJson(response);

  assert.equal(response.status, 202);
  assert.deepEqual(body, {
    accepted: true,
    status: "created",
    signalId: "signal-safe",
    shouldEvaluateOpportunity: true,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].deliveryId, "delivery-safe");
  assert.deepEqual(calls[0].payload, payload);
  assert.doesNotMatch(JSON.stringify(body), /privateBody|must-not-return|do-not-echo/);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("unconfigured storage and source mapping fail safely without asking GitHub to retry ordinary unmapped events", async () => {
  const secret = "webhook-secret";
  const storageUnavailable = createGithubWebhookHandler({
    webhookSecret: secret,
    createIngestionApplication: async () => {
      const error = new Error("missing database");
      error.code = "signalflow_database_unconfigured";
      throw error;
    },
  });
  const unavailableResponse = await storageUnavailable(signedRequest({ secret, payload: { action: "closed" } }));
  assert.equal(unavailableResponse.status, 503);
  assert.deepEqual(await responseJson(unavailableResponse), { error: "github_webhook_storage_unavailable" });

  const unmapped = createGithubWebhookHandler({
    webhookSecret: secret,
    createIngestionApplication: async () => ({
      async ingest() {
        const error = new Error("not mapped");
        error.code = "github_source_not_authorized";
        throw error;
      },
    }),
  });
  const unmappedResponse = await unmapped(signedRequest({ secret, payload: { action: "closed" } }));
  assert.equal(unmappedResponse.status, 202);
  assert.deepEqual(await responseJson(unmappedResponse), { accepted: true, status: "ignored_unmapped" });
});

test("missing secret, malformed headers, oversize body and ambiguous mapping have explicit outcomes", async () => {
  const noSecretHandler = createGithubWebhookHandler({
    webhookSecret: "",
    createIngestionApplication: async () => ({ ingest: async () => ({}) }),
  });
  assert.equal((await noSecretHandler(new Request("https://signalflow.invalid"))).status, 503);

  const secret = "webhook-secret";
  const handler = createGithubWebhookHandler({
    webhookSecret: secret,
    maxBodyBytes: 4,
    createIngestionApplication: async () => ({
      async ingest() {
        const error = new Error("ambiguous");
        error.code = "github_source_ambiguous";
        throw error;
      },
    }),
  });
  const missingHeaders = new Request("https://signalflow.invalid", { method: "POST", body: "{}" });
  assert.equal((await handler(missingHeaders)).status, 400);
  assert.equal((await handler(signedRequest({ secret, payload: { long: true } }))).status, 413);

  const ambiguityHandler = createGithubWebhookHandler({
    webhookSecret: secret,
    createIngestionApplication: async () => ({
      async ingest() {
        const error = new Error("ambiguous");
        error.code = "github_source_ambiguous";
        throw error;
      },
    }),
  });
  assert.equal((await ambiguityHandler(signedRequest({ secret, payload: { action: "closed" } }))).status, 409);
});

test("production route is Node-only, webhook-secret authenticated and does not reuse owner-session auth", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const route = fs.readFileSync(path.join(here, "../app/api/sources/github/webhook/route.js"), "utf8");
  assert.match(route, /runtime = "nodejs"/);
  assert.match(route, /GITHUB_WEBHOOK_SECRET/);
  assert.match(route, /createProductionGithubIngestionApplication/);
  assert.match(route, /createGithubWebhookHandler/);
  assert.doesNotMatch(route, /requireOwnerAccess|SIGNALFLOW_ACCESS_KEY/);
});
