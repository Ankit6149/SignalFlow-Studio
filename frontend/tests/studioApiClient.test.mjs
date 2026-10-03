import assert from "node:assert/strict";
import test from "node:test";

import {
  disconnectSocial,
  generateCampaign,
  getCapabilities,
  getOwnerSession,
  getSocialStatus,
  lockOwnerSession,
  publishPost,
  readGenerationResponse,
  testProviderRoute,
  unlockOwnerSession,
} from "../lib/studio/studioApiClient.mjs";

function jsonResponse(value, init = {}) {
  return new Response(JSON.stringify(value), {
    status: init.status || 200,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
  });
}

test("Studio API client owns capabilities provider session social and publish routes", async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    if (url === "/api/capabilities") return jsonResponse({ ok: true, capabilities: {} });
    if (url === "/api/provider_test") return jsonResponse({ ok: true, message: "ready" });
    if (url === "/api/session" && options.method === "POST") return jsonResponse({ authenticated: true, locked: true });
    if (url === "/api/session" && options.method === "DELETE") return new Response(null, { status: 204 });
    if (url === "/api/session") return jsonResponse({ authenticated: true });
    if (url === "/api/social/status") return jsonResponse({ platforms: { linkedin: { connected: true } } });
    if (url === "/api/social/disconnect") return jsonResponse({ ok: true });
    if (url === "/api/publish") return jsonResponse({ ok: true, message: "published" });
    throw new Error(`Unexpected request: ${url}`);
  };

  await getCapabilities({ fetchImpl });
  await testProviderRoute({ provider: "gemini" }, { fetchImpl });
  await getOwnerSession({ fetchImpl });
  await getSocialStatus({ fetchImpl });
  await disconnectSocial("linkedin", { fetchImpl });
  await publishPost({ platform: "linkedin", content: "Hello" }, { fetchImpl });
  await unlockOwnerSession("owner-key", { fetchImpl });
  await lockOwnerSession({ fetchImpl });

  assert.deepEqual(calls.map((call) => call.url), [
    "/api/capabilities",
    "/api/provider_test",
    "/api/session",
    "/api/social/status",
    "/api/social/disconnect",
    "/api/publish",
    "/api/session",
    "/api/session",
  ]);
  assert.equal(calls[1].options.method, "POST");
  assert.equal(JSON.parse(calls[1].options.body).provider, "gemini");
  assert.equal(JSON.parse(calls[4].options.body).platform, "linkedin");
  assert.equal(JSON.parse(calls[6].options.body).access_key, "owner-key");
  assert.equal(calls[7].options.method, "DELETE");
});

test("generation client preserves NDJSON progress and final result", async () => {
  const events = [
    JSON.stringify({ type: "progress", progress: { phase: "writing", status: "generating" } }),
    JSON.stringify({ type: "result", data: { ok: true, package: { posts: {} } } }),
    "",
  ].join("\n");

  const fetchImpl = async (url, options = {}) => {
    assert.equal(url, "/api/launch_kit");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.Accept, "application/x-ndjson");
    assert.deepEqual(JSON.parse(options.body).channels, ["linkedin"]);
    return new Response(events, {
      status: 200,
      headers: { "Content-Type": "application/x-ndjson" },
    });
  };

  const progress = [];
  const { response, data } = await generateCampaign(
    { channels: ["linkedin"] },
    { fetchImpl, onProgress: (value) => progress.push(value) },
  );

  assert.equal(response.ok, true);
  assert.equal(data.ok, true);
  assert.deepEqual(progress, [{ phase: "writing", status: "generating" }]);
});

test("generation response falls back to JSON and rejects unreadable bodies", async () => {
  const json = await readGenerationResponse(
    jsonResponse({ ok: true }),
    { fallbackMessage: "bad generation response" },
  );
  assert.equal(json.ok, true);

  await assert.rejects(
    readGenerationResponse(
      new Response("not-json", { status: 500, headers: { "Content-Type": "text/plain" } }),
      { fallbackMessage: "bad generation response" },
    ),
    /bad generation response \(HTTP 500\)/,
  );
});
