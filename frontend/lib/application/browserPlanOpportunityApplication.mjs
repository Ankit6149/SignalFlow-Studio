import { createBrowserContentOpportunityApplication } from "./browserContentOpportunityApplication.mjs";
import { createBrowserHostedContentOpportunityClient } from "../infrastructure/browserHostedContentOpportunityClient.mjs";

const DEFAULT_SNOOZE_DAYS = 7;

function presentationEntry(origin, opportunity) {
  return Object.freeze({
    key: `${origin}:${opportunity.opportunityId}`,
    origin,
    opportunity,
  });
}

function visibleOpportunity(opportunity, nowMs, includeRejected = false) {
  if (!includeRejected && ["rejected", "expired"].includes(opportunity.status)) return false;
  if (opportunity.status === "snoozed" && Date.parse(opportunity.snoozedUntil || "") > nowMs) return false;
  return true;
}

function errorState(error) {
  const status = Number(error?.status || 0);
  if ([401, 403, 503].includes(status)) {
    return Object.freeze({ status: "unavailable", code: String(error?.code || "hosted_opportunity_unavailable") });
  }
  return Object.freeze({ status: "error", code: String(error?.code || "hosted_opportunity_failed") });
}

export function createBrowserPlanOpportunityApplication({
  getStorage,
  workspaceId = "local-personal",
  fetchImpl = globalThis.fetch,
  localApplication = null,
  hostedClient = null,
  now = () => Date.now(),
} = {}) {
  const local = localApplication || createBrowserContentOpportunityApplication({ getStorage, workspaceId, fetchImpl });
  const hosted = hostedClient || createBrowserHostedContentOpportunityClient({ fetchImpl });

  async function listRankedOpportunities({ includeRejected = false } = {}) {
    const localItems = await local.listRankedOpportunities({ includeRejected: true });
    let hostedItems = [];
    let hostedState = Object.freeze({ status: "ready", code: null, workspaceId: null });
    try {
      const result = await hosted.listRankedOpportunities({ includeRejected: true });
      hostedItems = result.opportunities;
      hostedState = Object.freeze({ status: "ready", code: null, workspaceId: result.workspaceId || null });
    } catch (error) {
      hostedState = errorState(error);
    }
    const nowMs = Number(now());
    const entries = [
      ...hostedItems.filter((item) => visibleOpportunity(item, nowMs, includeRejected)).map((item) => presentationEntry("hosted", item)),
      ...localItems.filter((item) => visibleOpportunity(item, nowMs, includeRejected)).map((item) => presentationEntry("local", item)),
    ].sort((left, right) => Number(right.opportunity.score || 0) - Number(left.opportunity.score || 0));
    return Object.freeze({ entries, hostedState });
  }

  function requireEntry(entry) {
    if (!entry?.opportunity?.opportunityId || !["local", "hosted"].includes(entry.origin)) {
      throw new TypeError("A valid Plan opportunity entry is required.");
    }
    return entry;
  }

  async function selectAngle(entryInput, angleId) {
    const entry = requireEntry(entryInput);
    return entry.origin === "hosted"
      ? hosted.selectAngle(entry.opportunity.opportunityId, angleId)
      : local.selectAngle(entry.opportunity.opportunityId, angleId);
  }

  async function startHere(entryInput) {
    const entry = requireEntry(entryInput);
    if (!entry.opportunity.recommendedAngleId) {
      const error = new Error("SignalFlow did not identify one exact recommended direction. Choose one of the visible directions instead.");
      error.code = "opportunity_recommended_angle_required";
      throw error;
    }
    return entry.origin === "hosted"
      ? hosted.selectRecommended(entry.opportunity.opportunityId)
      : local.selectAngle(entry.opportunity.opportunityId, entry.opportunity.recommendedAngleId);
  }

  async function setCustomAngle(entryInput, customAngle) {
    const entry = requireEntry(entryInput);
    return entry.origin === "hosted"
      ? hosted.setCustomAngle(entry.opportunity.opportunityId, customAngle)
      : local.setCustomAngle(entry.opportunity.opportunityId, customAngle);
  }

  async function rejectOpportunity(entryInput) {
    const entry = requireEntry(entryInput);
    return entry.origin === "hosted"
      ? hosted.rejectOpportunity(entry.opportunity.opportunityId)
      : local.rejectOpportunity(entry.opportunity.opportunityId);
  }

  async function notNow(entryInput, { days = DEFAULT_SNOOZE_DAYS } = {}) {
    const entry = requireEntry(entryInput);
    const duration = Math.max(1, Math.min(30, Number(days) || DEFAULT_SNOOZE_DAYS));
    const snoozedUntil = new Date(Number(now()) + duration * 24 * 60 * 60 * 1000).toISOString();
    return entry.origin === "hosted"
      ? hosted.snoozeOpportunity(entry.opportunity.opportunityId, snoozedUntil)
      : local.snoozeOpportunity(entry.opportunity.opportunityId, snoozedUntil);
  }

  async function refresh(entryInput) {
    const entry = requireEntry(entryInput);
    const signalId = entry.opportunity.signalIds?.[0];
    if (!signalId) throw new Error("This opportunity has no source Signal to refresh.");
    return entry.origin === "hosted"
      ? hosted.refreshSignal(signalId)
      : local.evaluateSignal(signalId, { refresh: true });
  }

  return Object.freeze({
    listRankedOpportunities,
    selectAngle,
    startHere,
    setCustomAngle,
    rejectOpportunity,
    notNow,
    refresh,
  });
}

export { DEFAULT_SNOOZE_DAYS };
