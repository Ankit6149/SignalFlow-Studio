import { normalizeContentOpportunity, OPPORTUNITY_RECOMMENDATIONS } from "../domain/contentOpportunities.mjs";

export const AUTOPILOT_POLICY_VERSION = "owner-alpha-v1";

export const AUTOPILOT_OUTCOMES = Object.freeze({
  ADVANCE: "advance",
  NEEDS_PLAN: "needs_plan",
  NEEDS_VOICE: "needs_voice",
  NOT_WORTH_POSTING: "not_worth_posting",
});

export const AUTOPILOT_THRESHOLDS = Object.freeze({
  minimumScore: 78,
  minimumConfidence: 0.78,
  minimumEvidenceStrength: 65,
  minimumNarrativeFit: 65,
});

const ACCEPTABLE_READINESS = new Set(["strong", "medium"]);
const ACCEPTABLE_FRESHNESS = new Set(["fresh", "still_relevant", "evergreen", "expiring"]);
const SUPPORTED_DESTINATIONS = new Set(["linkedin", "x"]);
const TEXT_READY_MEDIA = new Set(["none", "text_only"]);

function result(outcome, reason, details = {}) {
  return Object.freeze({
    policyVersion: AUTOPILOT_POLICY_VERSION,
    outcome,
    reason,
    ...details,
  });
}

function recommendedDestinations(opportunity) {
  return opportunity.candidateDestinations
    .filter((item) => item.recommended !== false && SUPPORTED_DESTINATIONS.has(item.destination))
    .map((item) => item.destination);
}

function hasTextReadyPath(opportunity) {
  const media = Array.isArray(opportunity.recommendedMediaTypes) ? opportunity.recommendedMediaTypes : [];
  return media.length === 0 || media.some((item) => TEXT_READY_MEDIA.has(item));
}

export function evaluateOpportunityForAutopilot(opportunityInput) {
  const opportunity = normalizeContentOpportunity(opportunityInput);

  if (opportunity.recommendation === OPPORTUNITY_RECOMMENDATIONS.SKIP) {
    return result(AUTOPILOT_OUTCOMES.NOT_WORTH_POSTING, opportunity.whyNow || "SignalFlow does not recommend turning this signal into content.", {
      opportunityId: opportunity.opportunityId,
    });
  }
  if (opportunity.recommendation !== OPPORTUNITY_RECOMMENDATIONS.POST) {
    return result(AUTOPILOT_OUTCOMES.NEEDS_PLAN, "SignalFlow sees possible value here, but the opportunity is not strong enough to prepare automatically.", {
      opportunityId: opportunity.opportunityId,
      gate: "recommendation",
    });
  }
  if (opportunity.score < AUTOPILOT_THRESHOLDS.minimumScore) {
    return result(AUTOPILOT_OUTCOMES.NEEDS_PLAN, `Opportunity score ${opportunity.score}/100 is below the automatic-preparation threshold of ${AUTOPILOT_THRESHOLDS.minimumScore}.`, {
      opportunityId: opportunity.opportunityId,
      gate: "score",
    });
  }
  if (opportunity.confidence < AUTOPILOT_THRESHOLDS.minimumConfidence) {
    return result(AUTOPILOT_OUTCOMES.NEEDS_PLAN, `Opportunity confidence ${Math.round(opportunity.confidence * 100)}% is below the automatic-preparation threshold of ${Math.round(AUTOPILOT_THRESHOLDS.minimumConfidence * 100)}%.`, {
      opportunityId: opportunity.opportunityId,
      gate: "confidence",
    });
  }
  if (!ACCEPTABLE_READINESS.has(opportunity.evidenceReadiness.level) || opportunity.scoreBreakdown.evidenceStrength < AUTOPILOT_THRESHOLDS.minimumEvidenceStrength) {
    return result(AUTOPILOT_OUTCOMES.NEEDS_PLAN, "Evidence is not strong enough for SignalFlow to prepare the story without owner planning.", {
      opportunityId: opportunity.opportunityId,
      gate: "evidence",
    });
  }
  if (!ACCEPTABLE_READINESS.has(opportunity.narrativeFit.level) || opportunity.scoreBreakdown.narrativeFit < AUTOPILOT_THRESHOLDS.minimumNarrativeFit) {
    return result(AUTOPILOT_OUTCOMES.NEEDS_PLAN, "The narrative fit is not clear enough for automatic preparation.", {
      opportunityId: opportunity.opportunityId,
      gate: "narrative_fit",
    });
  }
  if (!ACCEPTABLE_FRESHNESS.has(opportunity.freshnessState)) {
    return result(AUTOPILOT_OUTCOMES.NEEDS_PLAN, "This opportunity is no longer fresh enough to prepare automatically.", {
      opportunityId: opportunity.opportunityId,
      gate: "freshness",
    });
  }
  if (opportunity.repetitionRisk.level === "high") {
    return result(AUTOPILOT_OUTCOMES.NEEDS_PLAN, "Repetition risk is high, so the owner should inspect the narrative before preparation continues.", {
      opportunityId: opportunity.opportunityId,
      gate: "repetition_risk",
    });
  }
  if (!opportunity.recommendedAngleId) {
    return result(AUTOPILOT_OUTCOMES.NEEDS_PLAN, "This opportunity predates explicit angle recommendation or the evaluator could not recommend one confidently.", {
      opportunityId: opportunity.opportunityId,
      gate: "recommended_angle",
    });
  }
  const angle = opportunity.candidateAngles.find((item) => item.angleId === opportunity.recommendedAngleId);
  if (!angle) {
    return result(AUTOPILOT_OUTCOMES.NEEDS_PLAN, "The recommended narrative angle is no longer present in the opportunity record.", {
      opportunityId: opportunity.opportunityId,
      gate: "recommended_angle",
    });
  }
  const destinations = recommendedDestinations(opportunity);
  if (destinations.length === 0) {
    return result(AUTOPILOT_OUTCOMES.NEEDS_PLAN, "No supported Golden Path destination is recommended strongly enough for automatic preparation.", {
      opportunityId: opportunity.opportunityId,
      gate: "destinations",
    });
  }
  if (!hasTextReadyPath(opportunity)) {
    return result(AUTOPILOT_OUTCOMES.NEEDS_PLAN, "This story currently depends on media production that the Personal Alpha autopilot does not yet provide.", {
      opportunityId: opportunity.opportunityId,
      gate: "media_requirement",
    });
  }

  return result(AUTOPILOT_OUTCOMES.ADVANCE, "The opportunity has enough editorial confidence, evidence and narrative fit to prepare for owner judgment.", {
    opportunityId: opportunity.opportunityId,
    angle,
    destinations,
    notes: opportunity.repetitionRisk.level === "unknown"
      ? ["NarrativeMemory is not implemented, so repetition was not treated as checked; the policy permits this unknown state for Personal Alpha."]
      : [],
  });
}

export function evaluateVoiceForAutopilot(minimalProfile, destinations = []) {
  const profile = minimalProfile && typeof minimalProfile === "object" ? minimalProfile : {};
  if (!profile.identity || !profile.voice || !profile.boundary) {
    return result(AUTOPILOT_OUTCOMES.NEEDS_VOICE, "Set up Identity, Voice and hard Boundaries before SignalFlow prepares content automatically.", {
      gate: "core_voice",
    });
  }
  const expressions = profile.platformExpressions || {};
  const missing = destinations.filter((destination) => !expressions[destination]);
  if (missing.length) {
    return result(AUTOPILOT_OUTCOMES.NEEDS_VOICE, `Add ${missing.map((item) => item === "x" ? "X" : "LinkedIn").join(" and ")} expression guidance before automatic preparation.`, {
      gate: "platform_voice",
      missingDestinations: missing,
    });
  }
  return result(AUTOPILOT_OUTCOMES.ADVANCE, "Explicit Voice and destination expression guidance are available.", {
    destinations: [...destinations],
  });
}
