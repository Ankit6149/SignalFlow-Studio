import { normalizeIdentityRecord } from "../domain/identityProfiles.mjs";

function requireFetch(fetchImpl) {
  if (typeof fetchImpl !== "function") throw new TypeError("Hosted identity client requires fetch().");
  return fetchImpl;
}

async function parseResponse(response) {
  const raw = await response.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    const error = new Error("Hosted identity API returned an unreadable response.");
    error.code = "hosted_identity_unreadable";
    error.status = response.status;
    throw error;
  }
  if (!response.ok || !data?.ok) {
    const error = new Error(data?.error || `Hosted identity request failed (HTTP ${response.status}).`);
    error.code = data?.code || "hosted_identity_failed";
    error.status = response.status;
    throw error;
  }
  return data;
}

function optionalRecord(value) {
  return value ? normalizeIdentityRecord(value) : null;
}

function normalizeProfile(profile = {}) {
  return Object.freeze({
    identity: optionalRecord(profile.identity),
    perception: optionalRecord(profile.perception),
    voice: optionalRecord(profile.voice),
    boundary: optionalRecord(profile.boundary),
    platformExpression: optionalRecord(profile.platformExpression),
    projectGuidance: optionalRecord(profile.projectGuidance),
    platformExpressions: Object.freeze({
      linkedin: optionalRecord(profile.platformExpressions?.linkedin),
      x: optionalRecord(profile.platformExpressions?.x),
    }),
  });
}

export function createBrowserHostedIdentityClient({ fetchImpl = globalThis.fetch } = {}) {
  const fetcher = requireFetch(fetchImpl);

  async function request(method, body = null) {
    const response = await fetcher("/api/identity", {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    return parseResponse(response);
  }

  async function getMinimalProfile() {
    const data = await request("GET");
    return {
      workspaceId: String(data.workspaceId || ""),
      userId: String(data.userId || ""),
      profile: normalizeProfile(data.profile || {}),
    };
  }

  async function saveMinimalProfile(profile) {
    if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
      throw new TypeError("Hosted identity save requires a profile object.");
    }
    const data = await request("POST", { profile });
    return {
      workspaceId: String(data.workspaceId || ""),
      userId: String(data.userId || ""),
      profile: normalizeProfile(data.profile || {}),
    };
  }

  return Object.freeze({ getMinimalProfile, saveMinimalProfile });
}
