import { createDomainRecord, parseDomainRecord, portableClone } from "./contracts.mjs";

export const PLATFORM_REVIEW_SCHEMA_VERSION = 1;
export const REVIEW_VERDICTS = Object.freeze({ PASS: "pass", WARN: "warn", BLOCK: "block" });
export const REVIEW_SEVERITIES = Object.freeze({ INFO: "info", WARNING: "warning", BLOCK: "block" });
export const APPROVAL_DECISIONS = Object.freeze({ APPROVED: "approved", REJECTED: "rejected" });

const VERDICT_VALUES = new Set(Object.values(REVIEW_VERDICTS));
const SEVERITY_VALUES = new Set(Object.values(REVIEW_SEVERITIES));
const DECISION_VALUES = new Set(Object.values(APPROVAL_DECISIONS));
const DESTINATIONS = new Set(["linkedin", "x"]);
const ROUTE_KINDS = new Set(["remote", "local"]);

function text(value, fallback = "", maxLength = 12000) {
  const normalized = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  const resolved = normalized || fallback;
  if (resolved.length > maxLength) throw new TypeError(`Platform review text exceeds ${maxLength} characters.`);
  return resolved;
}

function optionalText(value, maxLength = 12000) {
  return text(value, "", maxLength) || null;
}

function id(value, field, required = true) {
  const normalized = text(value, "", 240);
  if (!normalized && !required) return null;
  if (!normalized) throw new TypeError(`${field} is required.`);
  if (/[/\\]|^[a-zA-Z]:/.test(normalized)) throw new TypeError(`${field} must be an opaque ID.`);
  return normalized;
}

function timestamp(value, field) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new TypeError(`${field} must be an ISO timestamp.`);
  return new Date(parsed).toISOString();
}

function destination(value) {
  const normalized = text(value, "", 40).toLowerCase();
  if (!DESTINATIONS.has(normalized)) throw new TypeError(`Unsupported review destination: ${normalized || "missing"}.`);
  return normalized;
}

function finding(value = {}, index = 0) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`Review finding ${index + 1} must be an object.`);
  const severity = text(value.severity, REVIEW_SEVERITIES.WARNING, 40).toLowerCase();
  if (!SEVERITY_VALUES.has(severity)) throw new TypeError(`Unsupported review finding severity: ${severity}.`);
  return portableClone({
    code: text(value.code, `finding_${index + 1}`, 120).toLowerCase().replace(/[^a-z0-9_-]+/g, "_"),
    severity,
    message: text(value.message, "", 1200),
    suggestion: optionalText(value.suggestion, 1200),
    evidenceRefs: Array.from(new Set((Array.isArray(value.evidenceRefs) ? value.evidenceRefs : [])
      .map((item) => text(item, "", 240))
      .filter(Boolean))).slice(0, 24),
  });
}

function findings(values = []) {
  if (!Array.isArray(values)) throw new TypeError("Review findings must be an array.");
  return values.slice(0, 30).map(finding).filter((item) => item.message);
}

function deriveVerdict(items = []) {
  if (items.some((item) => item.severity === REVIEW_SEVERITIES.BLOCK)) return REVIEW_VERDICTS.BLOCK;
  if (items.some((item) => item.severity === REVIEW_SEVERITIES.WARNING)) return REVIEW_VERDICTS.WARN;
  return REVIEW_VERDICTS.PASS;
}

function criticProvenance(value = {}, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${field} provenance is required.`);
  const routeKind = text(value.routeKind, "", 40).toLowerCase();
  if (!ROUTE_KINDS.has(routeKind)) throw new TypeError(`${field} route must be remote or local.`);
  return portableClone({
    taskId: id(value.taskId, `${field}.taskId`),
    provider: text(value.provider, "", 80),
    model: text(value.model, "", 240),
    routeKind,
    promptVersion: text(value.promptVersion, "critic_v1", 80),
    reviewedAt: timestamp(value.reviewedAt, `${field}.reviewedAt`),
  });
}

export function normalizeCriticResult(input = {}, kind = "critic") {
  const normalizedFindings = findings(input.findings || []);
  const suppliedVerdict = text(input.verdict, "", 40).toLowerCase();
  const verdict = suppliedVerdict && VERDICT_VALUES.has(suppliedVerdict)
    ? suppliedVerdict
    : deriveVerdict(normalizedFindings);
  const derived = deriveVerdict(normalizedFindings);
  const rank = { pass: 0, warn: 1, block: 2 };
  return portableClone({
    verdict: rank[derived] > rank[verdict] ? derived : verdict,
    summary: text(input.summary, normalizedFindings.length ? `${normalizedFindings.length} ${kind} finding(s).` : `No blocking ${kind} findings.`, 1200),
    findings: normalizedFindings,
  });
}

function boundaryPrecheck(input = {}) {
  const blocked = findings((input.blocked || []).map((item, index) => ({
    code: item.code || `boundary_block_${index + 1}`,
    severity: REVIEW_SEVERITIES.BLOCK,
    message: item.message || item.rule || "Explicit boundary violation.",
    suggestion: item.suggestion || null,
    evidenceRefs: item.evidenceRefs || [],
  })));
  const warnings = findings((input.warnings || []).map((item, index) => ({
    code: item.code || `boundary_warning_${index + 1}`,
    severity: REVIEW_SEVERITIES.WARNING,
    message: item.message || item.rule || "Boundary/style warning.",
    suggestion: item.suggestion || null,
    evidenceRefs: item.evidenceRefs || [],
  })));
  return portableClone({ blocked, warnings, verdict: deriveVerdict([...blocked, ...warnings]) });
}

export function normalizePlatformVariantReview(input = {}) {
  const parsed = input?.kind === "PlatformVariantReview" && input?.schemaVersion
    ? parseDomainRecord(input, "PlatformVariantReview")
    : input;
  const evidence = normalizeCriticResult(parsed.evidence, "evidence");
  const authenticity = normalizeCriticResult(parsed.authenticity, "authenticity");
  const precheck = boundaryPrecheck(parsed.boundaryPrecheck);
  const allFindings = [...precheck.blocked, ...precheck.warnings, ...evidence.findings, ...authenticity.findings];
  return createDomainRecord("PlatformVariantReview", {
    reviewSchemaVersion: PLATFORM_REVIEW_SCHEMA_VERSION,
    platformVariantReviewId: id(parsed.platformVariantReviewId, "PlatformVariantReview.platformVariantReviewId"),
    workspaceId: id(parsed.workspaceId, "PlatformVariantReview.workspaceId"),
    platformVariantId: id(parsed.platformVariantId, "PlatformVariantReview.platformVariantId"),
    platformVariantRevisionId: id(parsed.platformVariantRevisionId, "PlatformVariantReview.platformVariantRevisionId"),
    contentPieceId: id(parsed.contentPieceId, "PlatformVariantReview.contentPieceId"),
    narrativeStrategyId: id(parsed.narrativeStrategyId, "PlatformVariantReview.narrativeStrategyId"),
    sourceSignalId: id(parsed.sourceSignalId, "PlatformVariantReview.sourceSignalId"),
    identityContextSnapshotId: id(parsed.identityContextSnapshotId, "PlatformVariantReview.identityContextSnapshotId"),
    destination: destination(parsed.destination),
    strategyRevision: Number.isInteger(parsed.strategyRevision) && parsed.strategyRevision > 0 ? parsed.strategyRevision : 1,
    overallVerdict: deriveVerdict(allFindings),
    boundaryPrecheck: precheck,
    evidence,
    authenticity,
    evidenceProvenance: criticProvenance(parsed.evidenceProvenance, "PlatformVariantReview.evidenceProvenance"),
    authenticityProvenance: criticProvenance(parsed.authenticityProvenance, "PlatformVariantReview.authenticityProvenance"),
    createdAt: timestamp(parsed.createdAt, "PlatformVariantReview.createdAt"),
  });
}

export function createPlatformVariantReview(values = {}) {
  return normalizePlatformVariantReview(values);
}

export function normalizePlatformVariantApproval(input = {}) {
  const parsed = input?.kind === "PlatformVariantApproval" && input?.schemaVersion
    ? parseDomainRecord(input, "PlatformVariantApproval")
    : input;
  const decision = text(parsed.decision, "", 40).toLowerCase();
  if (!DECISION_VALUES.has(decision)) throw new TypeError(`Unsupported review decision: ${decision || "missing"}.`);
  const reviewId = id(parsed.platformVariantReviewId, "PlatformVariantApproval.platformVariantReviewId", false);
  if (decision === APPROVAL_DECISIONS.APPROVED && !reviewId) {
    throw new TypeError("Approved PlatformVariantApproval requires the exact PlatformVariantReview ID.");
  }
  return createDomainRecord("PlatformVariantApproval", {
    approvalSchemaVersion: PLATFORM_REVIEW_SCHEMA_VERSION,
    platformVariantApprovalId: id(parsed.platformVariantApprovalId, "PlatformVariantApproval.platformVariantApprovalId"),
    workspaceId: id(parsed.workspaceId, "PlatformVariantApproval.workspaceId"),
    platformVariantId: id(parsed.platformVariantId, "PlatformVariantApproval.platformVariantId"),
    platformVariantRevisionId: id(parsed.platformVariantRevisionId, "PlatformVariantApproval.platformVariantRevisionId"),
    platformVariantReviewId: reviewId,
    destination: destination(parsed.destination),
    decision,
    note: optionalText(parsed.note, 2000),
    decidedBy: id(parsed.decidedBy, "PlatformVariantApproval.decidedBy"),
    decidedAt: timestamp(parsed.decidedAt, "PlatformVariantApproval.decidedAt"),
  });
}

export function createPlatformVariantApproval(values = {}) {
  return normalizePlatformVariantApproval(values);
}

export function reviewAllowsApproval(reviewInput) {
  const review = normalizePlatformVariantReview(reviewInput);
  return review.overallVerdict !== REVIEW_VERDICTS.BLOCK;
}
