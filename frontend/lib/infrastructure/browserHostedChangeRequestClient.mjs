import { normalizePlatformVariantRevision } from "../domain/platformVariantRevisions.mjs";

function requireFetch(fetchImpl) {
  if (typeof fetchImpl !== "function") throw new TypeError("Hosted change requests require fetch().");
  return fetchImpl;
}

function required(value, field, maxLength = 2400) {
  const normalized = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  if (!normalized || normalized.length > maxLength) throw new TypeError(`Hosted change request requires ${field}.`);
  return normalized;
}

async function parseResponse(response) {
  const raw = await response.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    const error = new Error("Hosted change-request API returned an unreadable response.");
    error.code = "hosted_platform_change_unreadable";
    error.status = response.status;
    throw error;
  }
  if (!response.ok || !data?.ok) {
    const error = new Error(data?.error || `Hosted change request failed (HTTP ${response.status}).`);
    error.code = data?.code || "hosted_platform_change_failed";
    error.status = response.status;
    throw error;
  }
  return data;
}

export function createBrowserHostedChangeRequestClient({ fetchImpl = globalThis.fetch } = {}) {
  const fetcher = requireFetch(fetchImpl);

  async function requestChange(platformVariantId, changeRequest, { expectedCurrentRevisionId } = {}) {
    const response = await fetcher("/api/platform-review/change-request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({
        platformVariantId: required(platformVariantId, "platformVariantId", 320),
        expectedCurrentRevisionId: required(expectedCurrentRevisionId, "expectedCurrentRevisionId", 320),
        changeRequest: required(changeRequest, "changeRequest", 2000),
      }),
    });
    const data = await parseResponse(response);
    return normalizePlatformVariantRevision(data.revision);
  }

  return Object.freeze({ requestChange });
}
