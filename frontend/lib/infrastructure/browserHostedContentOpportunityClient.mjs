import { normalizeContentOpportunity } from "../domain/contentOpportunities.mjs";

function requireFetch(fetchImpl) {
  if (typeof fetchImpl !== "function") throw new TypeError("Hosted opportunity client requires fetch().");
  return fetchImpl;
}

async function parseResponse(response) {
  const raw = await response.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    const error = new Error("Hosted opportunity API returned an unreadable response.");
    error.code = "hosted_opportunity_unreadable";
    error.status = response.status;
    throw error;
  }
  if (!response.ok || !data?.ok) {
    const error = new Error(data?.error || `Hosted opportunity request failed (HTTP ${response.status}).`);
    error.code = data?.code || "hosted_opportunity_failed";
    error.status = response.status;
    throw error;
  }
  return data;
}

export function createBrowserHostedContentOpportunityClient({ fetchImpl = globalThis.fetch } = {}) {
  const fetcher = requireFetch(fetchImpl);

  async function request(method, body = null, query = "") {
    const response = await fetcher(`/api/opportunities${query}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    return parseResponse(response);
  }

  async function listRankedOpportunities({ includeRejected = false } = {}) {
    const data = await request("GET", null, includeRejected ? "?includeRejected=1" : "");
    return {
      workspaceId: String(data.workspaceId || ""),
      opportunities: Array.isArray(data.opportunities) ? data.opportunities.map(normalizeContentOpportunity) : [],
    };
  }

  async function mutate(body) {
    const data = await request("PATCH", body);
    return normalizeContentOpportunity(data.opportunity);
  }

  return Object.freeze({
    listRankedOpportunities,
    selectAngle: (opportunityId, angleId) => mutate({ action: "select_angle", opportunityId, angleId }),
    selectRecommended: (opportunityId) => mutate({ action: "select_recommended", opportunityId }),
    setCustomAngle: (opportunityId, customAngle) => mutate({ action: "custom_angle", opportunityId, customAngle }),
    rejectOpportunity: (opportunityId) => mutate({ action: "reject", opportunityId }),
    snoozeOpportunity: (opportunityId, snoozedUntil) => mutate({ action: "snooze", opportunityId, snoozedUntil }),
    refreshSignal: (signalId) => mutate({ action: "refresh", signalId }),
  });
}
