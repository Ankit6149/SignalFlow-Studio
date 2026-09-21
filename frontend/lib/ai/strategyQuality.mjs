export const STRATEGY_QUALITY_STATES = Object.freeze({
  COMPLETE: "complete",
  NEEDS_REVIEW: "needs_review",
  FAILED: "failed",
});

function list(value) {
  return Array.isArray(value) ? value.filter((item) => String(item || "").trim()) : [];
}

function words(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9.%+-]+/g, " ")
    .split(/\s+/)
    .filter((item) => item.length >= 3);
}

function evidenceCorpus(context = {}) {
  return [
    ...list(context.confirmedFacts),
    ...list(context.features),
    ...list(context.techStack),
    ...list(context.repoInsights),
    ...list(context.docsInsights),
    ...list(context.linkInsights),
    String(context.notes || ""),
    String(context.repoContext?.rawContext || ""),
  ].join("\n").toLowerCase();
}

function quantitativeFragments(value) {
  return String(value || "").match(/(?:\b\d+(?:\.\d+)?%?\b|\b\d+[xkmb]\b)/gi) || [];
}

function claimHasEvidence(claim, corpus) {
  const tokens = words(claim).filter((token) => token.length >= 4);
  if (!tokens.length) return true;
  const matches = tokens.filter((token) => corpus.includes(token));
  return matches.length >= Math.min(3, Math.max(1, Math.ceil(tokens.length * 0.35)));
}

function issue(code, message, severity = "review") {
  return Object.freeze({ code, message, severity });
}

export function evaluateStrategyQuality({ rawBrief, package: pkg, selectedChannels = [], sourceContext = {} } = {}) {
  const issues = [];
  const raw = rawBrief && typeof rawBrief === "object" && !Array.isArray(rawBrief) ? rawBrief : null;
  const strategy = pkg?.strategy || {};
  const context = pkg?.context || {};
  const project = pkg?.project || {};
  const destinationAngles = strategy.destinationAngles || {};
  const selected = Array.from(new Set((selectedChannels || []).map((item) => String(item || "").trim()).filter(Boolean)));

  if (!raw || !raw.project || !raw.context || !raw.strategy) {
    issues.push(issue("strategy.invalid_structure", "Strategy response is missing required project/context/strategy objects.", "failed"));
  }
  if (!String(project.name || "").trim()) {
    issues.push(issue("strategy.project_missing", "Strategy must identify the project.", "failed"));
  }
  if (!String(strategy.coreAngle || "").trim()) {
    issues.push(issue("strategy.core_angle_missing", "Strategy needs one concrete core angle before destination writing.", "failed"));
  }
  if (!String(strategy.positioning || "").trim()) {
    issues.push(issue("strategy.positioning_missing", "Strategy needs a bounded positioning statement before destination writing.", "failed"));
  }

  for (const channel of selected) {
    if (!String(destinationAngles[channel] || "").trim()) {
      issues.push(issue("strategy.destination_angle_missing", `Strategy is missing an editorial angle for ${channel}.`, "failed"));
    }
  }

  if (!list(strategy.proofPoints).length) {
    issues.push(issue("strategy.proof_points_missing", "No proof points were identified; verify the strategy before generating public copy."));
  }
  if (!list(strategy.safeClaims).length) {
    issues.push(issue("strategy.safe_claims_missing", "No explicit safe claims were identified."));
  }
  if (!list(strategy.avoidClaims).length) {
    issues.push(issue("strategy.avoid_claims_missing", "No explicit avoid-claims boundary was returned."));
  }
  if (!Array.isArray(context.missingContext)) {
    issues.push(issue("strategy.missing_context_invalid", "Missing-context analysis is not represented as a list."));
  }

  const corpus = evidenceCorpus({ ...sourceContext, ...context });
  for (const claim of [...list(strategy.safeClaims), ...list(strategy.proofPoints)]) {
    const numbers = quantitativeFragments(claim);
    const unsupportedNumber = numbers.find((value) => !corpus.includes(String(value).toLowerCase()));
    if (unsupportedNumber) {
      issues.push(issue(
        "strategy.unsupported_quantitative_claim",
        `A strategy claim contains unsupported quantitative evidence: "${unsupportedNumber}".`,
      ));
      continue;
    }
    if (corpus && !claimHasEvidence(claim, corpus)) {
      issues.push(issue(
        "strategy.unverified_claim",
        "A proposed safe claim is not sufficiently grounded in the normalized source evidence.",
      ));
    }
  }

  const status = issues.some((item) => item.severity === "failed")
    ? STRATEGY_QUALITY_STATES.FAILED
    : issues.length
      ? STRATEGY_QUALITY_STATES.NEEDS_REVIEW
      : STRATEGY_QUALITY_STATES.COMPLETE;

  return Object.freeze({
    status,
    issues: Object.freeze(issues),
    issueCodes: Object.freeze(Array.from(new Set(issues.map((item) => item.code)))),
  });
}
