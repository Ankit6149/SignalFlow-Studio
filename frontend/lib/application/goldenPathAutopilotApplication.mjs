import {
  AUTOPILOT_OUTCOMES,
  AUTOPILOT_POLICY_VERSION,
  evaluateOpportunityForAutopilot,
  evaluateVoiceForAutopilot,
} from "./autopilotPolicy.mjs";

export const GOLDEN_AUTOPILOT_RESULTS = Object.freeze({
  READY_FOR_JUDGMENT: "ready_for_judgment",
  NEEDS_PLAN: "needs_plan",
  NEEDS_VOICE: "needs_voice",
  BLOCKED_PRIVACY: "blocked_privacy",
  NOT_WORTH_POSTING: "not_worth_posting",
  PARTIAL_FAILURE: "partial_failure",
  FAILED: "failed",
});

function requiredService(name, value, methods = []) {
  if (!value || typeof value !== "object") throw new TypeError(`${name} is required.`);
  for (const method of methods) {
    if (typeof value[method] !== "function") throw new TypeError(`${name}.${method}() is required.`);
  }
  return value;
}

function outcome(status, explanation, extra = {}) {
  return Object.freeze({
    status,
    explanation,
    policyVersion: AUTOPILOT_POLICY_VERSION,
    ...extra,
  });
}

function recordIds(state = {}) {
  return {
    signalId: state.signalId || null,
    opportunityId: state.opportunity?.opportunityId || null,
    narrativeStrategyId: state.strategy?.narrativeStrategyId || null,
    contentPieceId: state.contentPiece?.contentPieceId || null,
    platformVariantIds: Array.from(new Set((state.variants || []).map((item) => item.platformVariantId).filter(Boolean))),
    platformVariantRevisionIds: Array.from(new Set((state.reviews || []).map((item) => item.platformVariantRevisionId).filter(Boolean))),
    platformVariantReviewIds: Array.from(new Set((state.reviews || []).map((item) => item.platformVariantReviewId).filter(Boolean))),
  };
}

function mapPolicyResult(policy, state) {
  const base = { records: recordIds(state), nextRoute: state.opportunity?.opportunityId ? `/plan?opportunity=${encodeURIComponent(state.opportunity.opportunityId)}` : "/plan" };
  if (policy.outcome === AUTOPILOT_OUTCOMES.NEEDS_VOICE) {
    return outcome(GOLDEN_AUTOPILOT_RESULTS.NEEDS_VOICE, policy.reason, { ...base, nextRoute: "/voice", gate: policy.gate || null });
  }
  if (policy.outcome === AUTOPILOT_OUTCOMES.NOT_WORTH_POSTING) {
    return outcome(GOLDEN_AUTOPILOT_RESULTS.NOT_WORTH_POSTING, policy.reason, { ...base, nextRoute: "/signals", gate: policy.gate || null });
  }
  return outcome(GOLDEN_AUTOPILOT_RESULTS.NEEDS_PLAN, policy.reason, { ...base, gate: policy.gate || null });
}

function includedDestinations(strategy) {
  return strategy.destinationPlan.filter((item) => item.decision !== "exclude").map((item) => item.destination);
}

function recommendedDestinations(opportunity) {
  return (opportunity.candidateDestinations || [])
    .filter((item) => item.recommended !== false && ["linkedin", "x"].includes(item.destination))
    .map((item) => item.destination);
}

function repetitionCandidate(opportunity) {
  const angle = (opportunity.candidateAngles || []).find((item) => item.angleId === opportunity.recommendedAngleId) || null;
  return {
    projectId: opportunity.projectId || null,
    title: opportunity.title,
    summary: opportunity.summary,
    angle: angle?.title || "",
    angleSummary: angle?.summary || angle?.approach || "",
    coreIdea: opportunity.summary,
    destinations: recommendedDestinations(opportunity),
    occurredAt: opportunity.createdAt,
  };
}

function validateStrategyAgainstPolicy(strategy, policy) {
  const allowed = new Set(policy.destinations || []);
  const included = includedDestinations(strategy);
  if (!included.length) {
    return { ok: false, gate: "strategy_destinations", reason: "The generated strategy did not include any destination for preparation." };
  }
  const unauthorized = included.filter((destination) => !allowed.has(destination));
  if (unauthorized.length) {
    return { ok: false, gate: "strategy_destinations", reason: `The generated strategy tried to add ${unauthorized.join(" and ")} beyond the opportunity policy decision.` };
  }
  const unsupportedRequiredMedia = strategy.mediaRequirements.filter((item) => item.required && !["none", "text_only"].includes(item.type));
  if (unsupportedRequiredMedia.length) {
    return { ok: false, gate: "strategy_media", reason: "The strategy requires media production that Personal Alpha autopilot cannot safely complete yet." };
  }
  return { ok: true, included };
}

function strategyBoundaryText(strategy) {
  return [
    strategy.title,
    strategy.coreIdea,
    strategy.audienceTakeaway,
    strategy.hookDirection,
    ...(strategy.narrativeArc || []),
    ...(strategy.factualConstraints || []),
    ...(strategy.boundaryConstraints || []),
  ].filter(Boolean).join("\n");
}

function privacyFailure(error) {
  const code = String(error?.code || "").toLowerCase();
  return code.includes("privacy") || code === "inference_route_denied";
}

export function createGoldenPathAutopilotApplication({
  opportunityApplication,
  planningApplication,
  generationApplication,
  reviewApplication,
  identityApplication,
  narrativeMemoryApplication = null,
} = {}) {
  const memoryEnabled = Boolean(narrativeMemoryApplication);
  const opportunities = requiredService(
    "opportunityApplication",
    opportunityApplication,
    memoryEnabled ? ["evaluateSignal", "applyRepetitionReport"] : ["evaluateSignal"],
  );
  const planning = requiredService("planningApplication", planningApplication, ["buildStrategy", "approveStrategy"]);
  const generation = requiredService("generationApplication", generationApplication, ["generateReadyVariants"]);
  const reviews = requiredService("reviewApplication", reviewApplication, ["reviewCurrentVariant"]);
  const identity = requiredService("identityApplication", identityApplication, ["getMinimalProfile", "evaluateBoundaries"]);
  const narrativeMemory = memoryEnabled
    ? requiredService("narrativeMemoryApplication", narrativeMemoryApplication, ["repetitionReport"])
    : null;

  async function prepareSignal(signalId, { refreshOpportunity = false } = {}) {
    const state = { signalId, opportunity: null, strategy: null, contentPiece: null, variants: [], reviews: [] };

    try {
      state.opportunity = await opportunities.evaluateSignal(signalId, { refresh: refreshOpportunity });
    } catch (error) {
      if (privacyFailure(error)) {
        return outcome(GOLDEN_AUTOPILOT_RESULTS.BLOCKED_PRIVACY, error.message || "The Signal privacy policy does not permit the required inference route.", {
          records: recordIds(state),
          nextRoute: "/signals",
          code: error?.code || "inference_privacy_route_denied",
        });
      }
      return outcome(GOLDEN_AUTOPILOT_RESULTS.FAILED, error?.message || "SignalFlow could not evaluate this Signal.", {
        records: recordIds(state),
        nextRoute: "/signals",
        stage: "opportunity",
        code: error?.code || "opportunity_evaluation_failed",
      });
    }

    if (narrativeMemory) {
      try {
        const repetition = await narrativeMemory.repetitionReport(repetitionCandidate(state.opportunity));
        state.opportunity = await opportunities.applyRepetitionReport(state.opportunity.opportunityId, repetition);
      } catch (error) {
        return outcome(GOLDEN_AUTOPILOT_RESULTS.NEEDS_PLAN, "SignalFlow could not verify narrative repetition safely, so this opportunity needs owner planning before preparation continues.", {
          records: recordIds(state),
          nextRoute: `/plan?opportunity=${encodeURIComponent(state.opportunity.opportunityId)}`,
          gate: "narrative_memory",
          code: error?.code || "narrative_memory_check_failed",
        });
      }
    }

    const opportunityPolicy = evaluateOpportunityForAutopilot(state.opportunity);
    if (opportunityPolicy.outcome !== AUTOPILOT_OUTCOMES.ADVANCE) return mapPolicyResult(opportunityPolicy, state);

    const minimalProfile = await identity.getMinimalProfile();
    const voicePolicy = evaluateVoiceForAutopilot(minimalProfile, opportunityPolicy.destinations);
    if (voicePolicy.outcome !== AUTOPILOT_OUTCOMES.ADVANCE) return mapPolicyResult(voicePolicy, state);

    try {
      state.strategy = await planning.buildStrategy(state.opportunity.opportunityId, {
        angleDecision: {
          angleId: opportunityPolicy.angle.angleId,
          policyVersion: AUTOPILOT_POLICY_VERSION,
          reason: `Opportunity policy selected the evaluator-recommended angle after score, confidence, evidence, narrative, freshness, destination, media, and repetition gates passed.`,
        },
      });
    } catch (error) {
      if (privacyFailure(error)) {
        return outcome(GOLDEN_AUTOPILOT_RESULTS.BLOCKED_PRIVACY, error.message || "The Signal privacy policy does not permit strategy inference on the available route.", {
          records: recordIds(state),
          nextRoute: `/plan?opportunity=${encodeURIComponent(state.opportunity.opportunityId)}`,
          stage: "strategy",
          code: error?.code || "inference_privacy_route_denied",
        });
      }
      return outcome(GOLDEN_AUTOPILOT_RESULTS.PARTIAL_FAILURE, error?.message || "SignalFlow created the opportunity but could not build the strategy.", {
        records: recordIds(state),
        nextRoute: `/plan?opportunity=${encodeURIComponent(state.opportunity.opportunityId)}`,
        stage: "strategy",
        code: error?.code || "narrative_strategy_failed",
      });
    }

    const strategyPolicy = validateStrategyAgainstPolicy(state.strategy, opportunityPolicy);
    if (!strategyPolicy.ok) {
      return outcome(GOLDEN_AUTOPILOT_RESULTS.NEEDS_PLAN, strategyPolicy.reason, {
        records: recordIds(state),
        nextRoute: `/plan?opportunity=${encodeURIComponent(state.opportunity.opportunityId)}`,
        gate: strategyPolicy.gate,
      });
    }

    const boundary = await identity.evaluateBoundaries({
      text: strategyBoundaryText(state.strategy),
      snapshotId: state.strategy.identityContextSnapshotId,
    });
    if (!boundary.allowed) {
      return outcome(GOLDEN_AUTOPILOT_RESULTS.NEEDS_PLAN, "The proposed strategy conflicts with an explicit saved boundary, so SignalFlow stopped before internal acceptance.", {
        records: recordIds(state),
        nextRoute: `/plan?opportunity=${encodeURIComponent(state.opportunity.opportunityId)}`,
        gate: "strategy_boundary",
        blockers: boundary.blocked,
      });
    }

    let approvedBundle;
    try {
      approvedBundle = await planning.approveStrategy(state.strategy.narrativeStrategyId, {
        origin: "autopilot_policy",
        policyVersion: AUTOPILOT_POLICY_VERSION,
        reason: "Internal editorial strategy accepted for preparation after deterministic autopilot gates. This is not final content approval and does not authorize publishing.",
      });
      state.strategy = approvedBundle.strategy;
      state.contentPiece = approvedBundle.contentPiece;
      state.variants = approvedBundle.variants;
    } catch (error) {
      return outcome(GOLDEN_AUTOPILOT_RESULTS.PARTIAL_FAILURE, error?.message || "SignalFlow built a strategy but could not persist the preparation records.", {
        records: recordIds(state),
        nextRoute: `/plan?opportunity=${encodeURIComponent(state.opportunity.opportunityId)}`,
        stage: "strategy_acceptance",
        code: error?.code || "strategy_acceptance_failed",
      });
    }

    let generationResult;
    try {
      generationResult = await generation.generateReadyVariants(state.contentPiece.contentPieceId);
    } catch (error) {
      return outcome(GOLDEN_AUTOPILOT_RESULTS.PARTIAL_FAILURE, error?.message || "The plan was prepared but destination generation did not complete.", {
        records: recordIds(state),
        nextRoute: `/plan?opportunity=${encodeURIComponent(state.opportunity.opportunityId)}`,
        stage: "generation",
        code: error?.code || "platform_generation_failed",
      });
    }

    const generationFailures = [...(generationResult.failed || [])];
    const active = (generationResult.bundle?.variants || []).filter(({ variant }) => variant.status !== "omitted");
    for (const { variant, currentRevision } of active) {
      if (!currentRevision) {
        if (!generationFailures.some((item) => item.platformVariantId === variant.platformVariantId)) {
          generationFailures.push({ platformVariantId: variant.platformVariantId, destination: variant.destination, code: "missing_current_revision", message: "No current revision exists after generation." });
        }
        continue;
      }
      try {
        const review = await reviews.reviewCurrentVariant(variant.platformVariantId);
        state.reviews.push(review);
      } catch (error) {
        generationFailures.push({
          platformVariantId: variant.platformVariantId,
          destination: variant.destination,
          code: error?.code || "platform_review_failed",
          message: error?.message || "Exact revision critics did not complete.",
        });
      }
    }

    if (state.reviews.length === 0) {
      return outcome(GOLDEN_AUTOPILOT_RESULTS.PARTIAL_FAILURE, "SignalFlow prepared the story, but no destination completed exact review yet.", {
        records: recordIds(state),
        nextRoute: `/plan?opportunity=${encodeURIComponent(state.opportunity.opportunityId)}`,
        stage: "review",
        failures: generationFailures,
      });
    }

    if (generationFailures.length) {
      return outcome(GOLDEN_AUTOPILOT_RESULTS.PARTIAL_FAILURE, "Some destination work is ready for judgment, but part of preparation did not complete. Completed reviewed revisions are available in Today; the remaining failure is preserved for recovery.", {
        records: recordIds(state),
        nextRoute: "/today",
        stage: "review",
        failures: generationFailures,
        reviewedCount: state.reviews.length,
      });
    }

    return outcome(GOLDEN_AUTOPILOT_RESULTS.READY_FOR_JUDGMENT, "SignalFlow prepared the high-confidence story, generated the supported destination drafts, and completed exact evidence/authenticity checks. Your judgment is the remaining gate.", {
      records: recordIds(state),
      nextRoute: "/today",
      reviewedCount: state.reviews.length,
      notes: opportunityPolicy.notes || [],
    });
  }

  return { prepareSignal };
}
