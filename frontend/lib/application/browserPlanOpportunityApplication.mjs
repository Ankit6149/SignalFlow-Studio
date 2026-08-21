import { createBrowserContentOpportunityApplication } from "./browserContentOpportunityApplication.mjs";
import { createBrowserIdentityApplication } from "./browserIdentityApplication.mjs";
import { createBrowserHostedContentOpportunityClient } from "../infrastructure/browserHostedContentOpportunityClient.mjs";
import { createBrowserHostedIdentityClient } from "../infrastructure/browserHostedIdentityClient.mjs";
import { createBrowserHostedPlanningClient } from "../infrastructure/browserHostedPlanningClient.mjs";

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

function profileInput(bundle = {}) {
  const identity = bundle.identity || {};
  const perception = bundle.perception || {};
  const voice = bundle.voice || {};
  const boundary = bundle.boundary || {};
  const linkedin = bundle.platformExpressions?.linkedin || {};
  const x = bundle.platformExpressions?.x || {};
  return Object.freeze({
    primaryTopics: identity.primaryTopics || [],
    expertise: identity.expertise || [],
    interests: identity.interests || [],
    worldviewNotes: identity.worldviewNotes || "",
    recurringThemes: identity.recurringThemes || [],
    personalityTraits: identity.personalityTraits || [],
    backgroundContext: identity.backgroundContext || "",
    technicalDepth: identity.technicalDepth || "balanced",
    vulnerabilityPreference: identity.vulnerabilityPreference || "selective",
    humorStyle: identity.humorStyle || "",
    confidenceStyle: identity.confidenceStyle || "",
    approvedContextNotes: identity.approvedContextNotes || [],
    qualitiesToSignal: perception.qualitiesToSignal || [],
    qualitiesToAvoid: perception.qualitiesToAvoid || [],
    desiredAudienceImpressions: perception.desiredAudienceImpressions || [],
    longTermNarrative: perception.longTermNarrative || [],
    currentPositioning: perception.currentPositioning || [],
    credibilitySignals: perception.credibilitySignals || [],
    perceptionAntiPatterns: perception.antiPatterns || [],
    writingPrinciples: voice.writingPrinciples || [],
    dislikes: voice.dislikes || [],
    openingPreferences: voice.openingPreferences || [],
    openingAntiPatterns: voice.openingAntiPatterns || [],
    preferredVocabulary: voice.preferredVocabulary || [],
    bannedVocabulary: voice.bannedVocabulary || [],
    rhythm: voice.rhythm || "",
    emojiPolicy: voice.emojiPolicy || "rare",
    hashtagPolicy: voice.hashtagPolicy || "",
    ctaStyle: voice.ctaStyle || "",
    formattingPreferences: voice.formattingPreferences || [],
    storytellingPatterns: voice.storytellingPatterns || [],
    technicalExplanationStyle: voice.technicalExplanationStyle || "",
    approvedExamples: voice.approvedExamples || [],
    rejectedExamples: voice.rejectedExamples || [],
    blockedTopics: boundary.blockedTopics || [],
    blockedPeopleProjects: boundary.blockedPeopleProjects || [],
    blockedPhrases: boundary.blockedPhrases || [],
    unverifiedMetricsPolicy: boundary.unverifiedMetricsPolicy || "block",
    fabricatedVulnerabilityPolicy: boundary.fabricatedVulnerabilityPolicy || "block",
    exaggeratedLaunchLanguagePolicy: boundary.exaggeratedLaunchLanguagePolicy || "warn",
    customBoundaryRules: (boundary.customRules || []).map((item) => item.rule).filter(Boolean),
    linkedinRules: linkedin.expressionRules || [],
    xRules: x.expressionRules || [],
  });
}

function sameProfile(left, right) {
  return JSON.stringify(profileInput(left)) === JSON.stringify(profileInput(right));
}

export function createBrowserPlanOpportunityApplication({
  getStorage,
  workspaceId = "local-personal",
  fetchImpl = globalThis.fetch,
  localApplication = null,
  hostedClient = null,
  identityApplication = null,
  hostedIdentityClient = null,
  hostedPlanningClient = null,
  now = () => Date.now(),
} = {}) {
  const local = localApplication || createBrowserContentOpportunityApplication({ getStorage, workspaceId, fetchImpl });
  const hosted = hostedClient || createBrowserHostedContentOpportunityClient({ fetchImpl });
  const hostedIdentity = hostedIdentityClient || createBrowserHostedIdentityClient({ fetchImpl });
  const hostedPlanning = hostedPlanningClient || createBrowserHostedPlanningClient({ fetchImpl });
  let resolvedIdentity = identityApplication || null;

  function getIdentityApplication() {
    if (!resolvedIdentity) {
      resolvedIdentity = createBrowserIdentityApplication({ getStorage, workspaceId });
    }
    return resolvedIdentity;
  }

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

  function requireHostedEntry(entryInput) {
    const entry = requireEntry(entryInput);
    if (entry.origin !== "hosted") throw new TypeError("Hosted planning requires a connected-source Opportunity.");
    return entry;
  }

  async function ensureHostedIdentity() {
    const localProfile = await getIdentityApplication().getMinimalProfile();
    if (!localProfile?.identity || !localProfile?.voice || !localProfile?.boundary) {
      const error = new Error("Set up your explicit Voice profile before SignalFlow builds the connected-source plan.");
      error.code = "voice_profile_required";
      throw error;
    }
    const current = await hostedIdentity.getMinimalProfile();
    if (sameProfile(localProfile, current.profile)) return current;
    return hostedIdentity.saveMinimalProfile(profileInput(localProfile));
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

  async function getHostedPlan(entryInput) {
    const entry = requireHostedEntry(entryInput);
    return hostedPlanning.getPlanBundle(entry.opportunity.opportunityId);
  }

  async function buildHostedPlan(entryInput, options = {}) {
    const entry = requireHostedEntry(entryInput);
    if (!entry.opportunity.selectedAngleId) {
      const error = new Error("Choose one exact narrative direction before SignalFlow builds the hosted plan.");
      error.code = "planning_angle_required";
      throw error;
    }
    await ensureHostedIdentity();
    return hostedPlanning.buildStrategy(entry.opportunity.opportunityId, options);
  }

  async function reviseHostedPlan(entryInput, strategy, patch) {
    const entry = requireHostedEntry(entryInput);
    return hostedPlanning.reviseStrategy(entry.opportunity.opportunityId, strategy, patch);
  }

  async function approveHostedPlan(entryInput, strategy, decision = {}) {
    const entry = requireHostedEntry(entryInput);
    return hostedPlanning.approveStrategy(entry.opportunity.opportunityId, strategy, decision);
  }

  return Object.freeze({
    listRankedOpportunities,
    selectAngle,
    startHere,
    setCustomAngle,
    rejectOpportunity,
    notNow,
    refresh,
    getHostedPlan,
    buildHostedPlan,
    reviseHostedPlan,
    approveHostedPlan,
    ensureHostedIdentity,
  });
}

export { DEFAULT_SNOOZE_DAYS, profileInput };
