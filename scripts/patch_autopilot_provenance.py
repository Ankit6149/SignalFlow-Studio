from pathlib import Path


def replace_once(path, old, new, label):
    text = path.read_text()
    if old not in text:
        raise SystemExit(f"missing expected text: {label}")
    path.write_text(text.replace(old, new, 1))


opportunity = Path("frontend/lib/domain/contentOpportunities.mjs")
replace_once(
    opportunity,
    '''export function normalizeOpportunityEvaluation(input = {}) {
  const recommendation = enumValue(input.recommendation, RECOMMENDATION_VALUES, OPPORTUNITY_RECOMMENDATIONS.HOLD, "recommendation");
  const angles = normalizeAngles(input.candidateAngles, { required: recommendation === OPPORTUNITY_RECOMMENDATIONS.POST });
  return portableClone({''',
    '''export function normalizeOpportunityEvaluation(input = {}) {
  const recommendation = enumValue(input.recommendation, RECOMMENDATION_VALUES, OPPORTUNITY_RECOMMENDATIONS.HOLD, "recommendation");
  const angles = normalizeAngles(input.candidateAngles, { required: recommendation === OPPORTUNITY_RECOMMENDATIONS.POST });
  const requestedAngleId = optionalText(input.recommendedAngleId, 120);
  const recommendedAngleTitle = text(input.recommendedAngleTitle, "", 160).toLowerCase();
  const recommendedAngle = requestedAngleId
    ? angles.find((item) => item.angleId === requestedAngleId) || null
    : recommendedAngleTitle
      ? angles.find((item) => item.title.toLowerCase() === recommendedAngleTitle) || null
      : null;
  return portableClone({''',
    "opportunity evaluation recommendation resolver",
)
replace_once(
    opportunity,
    '''    candidateAngles: angles,
    candidateDestinations: normalizeDestinations(input.candidateDestinations),''',
    '''    candidateAngles: angles,
    recommendedAngleId: recommendation === OPPORTUNITY_RECOMMENDATIONS.POST ? recommendedAngle?.angleId || null : null,
    candidateDestinations: normalizeDestinations(input.candidateDestinations),''',
    "opportunity recommendedAngleId output",
)

planning_domain = Path("frontend/lib/domain/contentPlanning.mjs")
replace_once(
    planning_domain,
    'const DESTINATION_DECISIONS = new Set(["include", "optional", "exclude"]);',
    '''const DESTINATION_DECISIONS = new Set(["include", "optional", "exclude"]);
const ANGLE_SELECTION_ORIGINS = new Set(["owner", "autopilot_policy"]);
const STRATEGY_APPROVAL_ORIGINS = new Set(["owner", "autopilot_policy"]);''',
    "planning provenance enums",
)
replace_once(
    planning_domain,
    '''  return portableClone({
    angleId: text(value.angleId, "custom", 120),
    title: text(value.title, "Something else", 200),
    summary: text(value.summary, "", 1800),
    approach: text(value.approach || value.summary, "", 1800),
  });''',
    '''  return portableClone({
    angleId: text(value.angleId, "custom", 120),
    title: text(value.title, "Something else", 200),
    summary: text(value.summary, "", 1800),
    approach: text(value.approach || value.summary, "", 1800),
    selectionOrigin: enumValue(value.selectionOrigin, ANGLE_SELECTION_ORIGINS, "owner", "NarrativeStrategy.selectedAngle.selectionOrigin"),
    selectionPolicyVersion: optionalText(value.selectionPolicyVersion, 160),
    selectionReason: optionalText(value.selectionReason, 1200),
  });''',
    "selected angle provenance",
)
replace_once(
    planning_domain,
    '''  if (!proposal.coreIdea || !proposal.audienceTakeaway || proposal.narrativeArc.length < 2) {
    throw new TypeError("NarrativeStrategy requires a core idea, audience takeaway, and at least two narrative-arc beats.");
  }
  return createDomainRecord("NarrativeStrategy", {''',
    '''  if (!proposal.coreIdea || !proposal.audienceTakeaway || proposal.narrativeArc.length < 2) {
    throw new TypeError("NarrativeStrategy requires a core idea, audience takeaway, and at least two narrative-arc beats.");
  }
  const strategyStatus = enumValue(parsed.status, STRATEGY_STATUS_VALUES, STRATEGY_STATUSES.DRAFT, "NarrativeStrategy.status");
  return createDomainRecord("NarrativeStrategy", {''',
    "strategy normalized status",
)
replace_once(
    planning_domain,
    '    status: enumValue(parsed.status, STRATEGY_STATUS_VALUES, STRATEGY_STATUSES.DRAFT, "NarrativeStrategy.status"),',
    '    status: strategyStatus,',
    "strategy status field",
)
replace_once(
    planning_domain,
    '''    updatedAt: timestamp(parsed.updatedAt, createdAt, "NarrativeStrategy.updatedAt"),
    approvedAt: timestamp(parsed.approvedAt, null, "NarrativeStrategy.approvedAt"),
  });''',
    '''    updatedAt: timestamp(parsed.updatedAt, createdAt, "NarrativeStrategy.updatedAt"),
    approvedAt: timestamp(parsed.approvedAt, null, "NarrativeStrategy.approvedAt"),
    approvalOrigin: strategyStatus === STRATEGY_STATUSES.APPROVED
      ? enumValue(parsed.approvalOrigin, STRATEGY_APPROVAL_ORIGINS, "owner", "NarrativeStrategy.approvalOrigin")
      : null,
    approvalPolicyVersion: strategyStatus === STRATEGY_STATUSES.APPROVED ? optionalText(parsed.approvalPolicyVersion, 160) : null,
    approvalReason: strategyStatus === STRATEGY_STATUSES.APPROVED ? optionalText(parsed.approvalReason, 1200) : null,
  });''',
    "strategy approval provenance fields",
)
replace_once(
    planning_domain,
    '''    status: STRATEGY_STATUSES.DRAFT,
    approvedAt: null,
    updatedAt: timestamp(now, strategy.updatedAt, "NarrativeStrategy.updatedAt"),''',
    '''    status: STRATEGY_STATUSES.DRAFT,
    approvedAt: null,
    approvalOrigin: null,
    approvalPolicyVersion: null,
    approvalReason: null,
    updatedAt: timestamp(now, strategy.updatedAt, "NarrativeStrategy.updatedAt"),''',
    "strategy revision clears approval provenance",
)
replace_once(
    planning_domain,
    '''export function approveNarrativeStrategy(strategyInput, now) {
  const strategy = normalizeNarrativeStrategy(strategyInput);
  return normalizeNarrativeStrategy({
    ...strategy,
    status: STRATEGY_STATUSES.APPROVED,
    approvedAt: timestamp(now, strategy.updatedAt, "NarrativeStrategy.approvedAt"),
    updatedAt: timestamp(now, strategy.updatedAt, "NarrativeStrategy.updatedAt"),
  });
}''',
    '''export function approveNarrativeStrategy(strategyInput, now, decision = {}) {
  const strategy = normalizeNarrativeStrategy(strategyInput);
  return normalizeNarrativeStrategy({
    ...strategy,
    status: STRATEGY_STATUSES.APPROVED,
    approvedAt: timestamp(now, strategy.updatedAt, "NarrativeStrategy.approvedAt"),
    approvalOrigin: decision.origin || "owner",
    approvalPolicyVersion: decision.policyVersion || null,
    approvalReason: decision.reason || null,
    updatedAt: timestamp(now, strategy.updatedAt, "NarrativeStrategy.updatedAt"),
  });
}''',
    "approveNarrativeStrategy provenance",
)

planning_app = Path("frontend/lib/application/contentPlanningApplication.mjs")
replace_once(
    planning_app,
    '''function selectedAngle(opportunity) {
  if (!opportunity.selectedAngleId) throw new Error("Choose a narrative direction before building a campaign plan.");
  if (opportunity.selectedAngleId === "custom") {
    if (!opportunity.customAngle) throw new Error("The custom narrative direction is missing.");
    return {
      angleId: "custom",
      title: opportunity.customAngle.title || "Something else",
      summary: opportunity.customAngle.summary,
      approach: opportunity.customAngle.approach || opportunity.customAngle.summary,
    };
  }
  const angle = opportunity.candidateAngles.find((item) => item.angleId === opportunity.selectedAngleId);
  if (!angle) throw new Error(`Selected opportunity angle ${opportunity.selectedAngleId} no longer exists.`);
  return angle;
}''',
    '''function selectedAngle(opportunity, decision = null) {
  if (decision?.angleId) {
    const angle = opportunity.candidateAngles.find((item) => item.angleId === decision.angleId);
    if (!angle) throw new Error(`Autopilot opportunity angle ${decision.angleId} no longer exists.`);
    return {
      ...angle,
      selectionOrigin: "autopilot_policy",
      selectionPolicyVersion: decision.policyVersion || null,
      selectionReason: decision.reason || null,
    };
  }
  if (!opportunity.selectedAngleId) throw new Error("Choose a narrative direction before building a campaign plan.");
  if (opportunity.selectedAngleId === "custom") {
    if (!opportunity.customAngle) throw new Error("The custom narrative direction is missing.");
    return {
      angleId: "custom",
      title: opportunity.customAngle.title || "Something else",
      summary: opportunity.customAngle.summary,
      approach: opportunity.customAngle.approach || opportunity.customAngle.summary,
      selectionOrigin: "owner",
      selectionPolicyVersion: null,
      selectionReason: null,
    };
  }
  const angle = opportunity.candidateAngles.find((item) => item.angleId === opportunity.selectedAngleId);
  if (!angle) throw new Error(`Selected opportunity angle ${opportunity.selectedAngleId} no longer exists.`);
  return {
    ...angle,
    selectionOrigin: "owner",
    selectionPolicyVersion: null,
    selectionReason: null,
  };
}''',
    "planning selectedAngle helper",
)
replace_once(
    planning_app,
    '''      approach: angle.approach,
    },
    identityProfileRefs: identitySnapshot.profileRefs || {},''',
    '''      approach: angle.approach,
      selectionOrigin: angle.selectionOrigin || "owner",
      selectionPolicyVersion: angle.selectionPolicyVersion || null,
    },
    identityProfileRefs: identitySnapshot.profileRefs || {},''',
    "strategy fingerprint provenance",
)
replace_once(
    planning_app,
    '  async function buildStrategy(opportunityId, { refresh = false } = {}) {',
    '  async function buildStrategy(opportunityId, { refresh = false, angleDecision = null } = {}) {',
    "buildStrategy angleDecision",
)
replace_once(
    planning_app,
    '    const angle = selectedAngle(opportunity);',
    '    const angle = selectedAngle(opportunity, angleDecision);',
    "buildStrategy selected angle",
)
replace_once(
    planning_app,
    '''  async function approveStrategy(strategyId) {
    const strategy = await requireStrategy(strategyId);
    const now = appClock.now();
    const approved = await plans.upsert(approveNarrativeStrategy(strategy, now));''',
    '''  async function approveStrategy(strategyId, decision = {}) {
    const strategy = await requireStrategy(strategyId);
    const now = appClock.now();
    const approved = await plans.upsert(approveNarrativeStrategy(strategy, now, decision));''',
    "approveStrategy provenance",
)

print("patched autopilot provenance contracts")
