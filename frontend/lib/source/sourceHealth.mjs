import { parseGitHubUrl } from "../context/githubUrl.mjs";

export const SOURCE_HEALTH_REPORT_VERSION = 1;

export const SOURCE_HEALTH_STATUSES = Object.freeze({
  READY: "ready",
  NEEDS_VERIFICATION: "needs_verification",
  BLOCKED: "blocked",
});

export const SOURCE_HEALTH_ENTRY_STATUSES = Object.freeze({
  USABLE: "usable",
  NEEDS_VERIFICATION: "needs_verification",
  REFERENCE_ONLY: "reference_only",
  FAILED: "failed",
  INVALID: "invalid",
  DUPLICATE: "duplicate",
  PROCESSING: "processing",
  UNSUPPORTED: "unsupported",
  BLOCKED: "blocked",
  TRUNCATED: "truncated",
  STALE: "stale",
});

const SENSITIVE_QUERY = /(^|[-_])(token|key|signature|sig|credential|authorization|expires|x-amz-)/i;

function text(value) {
  return String(value || "").trim();
}

function normalizeDocuments(value) {
  return (Array.isArray(value) ? value : [value])
    .map((item) => text(item))
    .filter(Boolean);
}

export function normalizeSourceLinkCandidate(value) {
  const raw = text(value);
  if (!raw) return Object.freeze({ ok: false, code: "empty_link", canonicalUrl: null });
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) && !/^https?:\/\//i.test(raw)) {
    return Object.freeze({ ok: false, code: "invalid_link", canonicalUrl: null });
  }
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (!["http:", "https:"].includes(url.protocol)) {
      return Object.freeze({ ok: false, code: "invalid_link", canonicalUrl: null });
    }
    if (url.username || url.password) {
      return Object.freeze({ ok: false, code: "credential_link", canonicalUrl: null });
    }
    for (const key of url.searchParams.keys()) {
      if (SENSITIVE_QUERY.test(key)) {
        return Object.freeze({ ok: false, code: "credential_link", canonicalUrl: null });
      }
    }
    url.hash = "";
    const sorted = [...url.searchParams.entries()].sort(([ak, av], [bk, bv]) => (
      ak.localeCompare(bk) || av.localeCompare(bv)
    ));
    url.search = "";
    for (const [key, item] of sorted) url.searchParams.append(key, item);
    return Object.freeze({ ok: true, code: null, canonicalUrl: url.toString() });
  } catch {
    return Object.freeze({ ok: false, code: "invalid_link", canonicalUrl: null });
  }
}

export function parseSourceLinkCandidates(value) {
  const raw = text(value);
  if (!raw) return Object.freeze([]);
  const seen = new Set();
  const entries = [];
  for (const token of raw.split(/\s+/).filter(Boolean)) {
    const normalized = normalizeSourceLinkCandidate(token);
    if (!normalized.ok) {
      entries.push(Object.freeze({
        kind: "link",
        sourceKind: "link",
        displayName: "Invalid link",
        input: token,
        canonicalUrl: null,
        status: SOURCE_HEALTH_ENTRY_STATUSES.INVALID,
        issueCode: normalized.code,
        recoveryAction: recoveryAction(SOURCE_HEALTH_ENTRY_STATUSES.INVALID, normalized.code),
      }));
      continue;
    }
    if (seen.has(normalized.canonicalUrl)) {
      entries.push(Object.freeze({
        kind: "link",
        sourceKind: "link",
        displayName: normalized.canonicalUrl,
        input: token,
        canonicalUrl: normalized.canonicalUrl,
        status: SOURCE_HEALTH_ENTRY_STATUSES.DUPLICATE,
        issueCode: "duplicate_link",
        recoveryAction: recoveryAction(SOURCE_HEALTH_ENTRY_STATUSES.DUPLICATE, "duplicate_link"),
      }));
      continue;
    }
    seen.add(normalized.canonicalUrl);
    entries.push(Object.freeze({
      kind: "link",
      sourceKind: "link",
      displayName: normalized.canonicalUrl,
      input: token,
      canonicalUrl: normalized.canonicalUrl,
      status: SOURCE_HEALTH_ENTRY_STATUSES.NEEDS_VERIFICATION,
      issueCode: null,
      recoveryAction: recoveryAction(SOURCE_HEALTH_ENTRY_STATUSES.NEEDS_VERIFICATION),
    }));
  }
  return Object.freeze(entries);
}

function recoveryAction(status, issueCode = "") {
  if (status === SOURCE_HEALTH_ENTRY_STATUSES.NEEDS_VERIFICATION) return "Build or verify this source before relying on it as evidence.";
  if (status === SOURCE_HEALTH_ENTRY_STATUSES.PROCESSING) return "Wait for source processing to complete, then retry generation.";
  if (status === SOURCE_HEALTH_ENTRY_STATUSES.REFERENCE_ONLY) return "Add extractable evidence or keep this source as context only.";
  if (status === SOURCE_HEALTH_ENTRY_STATUSES.UNSUPPORTED) return "Replace this source with a supported text, document, image, or repository input.";
  if (status === SOURCE_HEALTH_ENTRY_STATUSES.BLOCKED) return "Use a public, policy-safe source or remove this blocked source.";
  if (status === SOURCE_HEALTH_ENTRY_STATUSES.INVALID) return "Correct the source address or identifier.";
  if (status === SOURCE_HEALTH_ENTRY_STATUSES.DUPLICATE) return "No action needed; SignalFlow uses the first canonical copy.";
  if (status === SOURCE_HEALTH_ENTRY_STATUSES.TRUNCATED) return "Review the retained extraction; narrow or split the source if missing detail matters.";
  if (status === SOURCE_HEALTH_ENTRY_STATUSES.STALE) return "Refresh or re-ingest this source before using it for new claims.";
  if (status === SOURCE_HEALTH_ENTRY_STATUSES.FAILED) {
    if (issueCode === "source_fetch_timeout") return "Retry later or replace the source with another public evidence URL.";
    return "Retry the source or replace it with evidence SignalFlow can verify.";
  }
  return "";
}

function artifactHealthStatus(artifact) {
  if (artifact?.stale === true || artifact?.usability?.stale === true) return SOURCE_HEALTH_ENTRY_STATUSES.STALE;
  if (usableArtifact(artifact)) {
    return artifact?.extraction?.truncated
      ? SOURCE_HEALTH_ENTRY_STATUSES.TRUNCATED
      : SOURCE_HEALTH_ENTRY_STATUSES.USABLE;
  }
  const usability = String(artifact?.usability?.state || "");
  if (usability === "processing") return SOURCE_HEALTH_ENTRY_STATUSES.PROCESSING;
  if (usability === "reference_only") return SOURCE_HEALTH_ENTRY_STATUSES.REFERENCE_ONLY;
  if (usability === "unsupported") return SOURCE_HEALTH_ENTRY_STATUSES.UNSUPPORTED;
  return SOURCE_HEALTH_ENTRY_STATUSES.FAILED;
}

function safeArtifactEntry(artifact) {
  const status = artifactHealthStatus(artifact);
  const issueCode = artifact?.usability?.issueCodes?.[0]
    || artifact?.extraction?.issueCodes?.[0]
    || null;
  const canonicalUrl = artifact?.sourceReference?.canonicalUrl
    && /^https?:\/\//i.test(String(artifact.sourceReference.canonicalUrl))
      ? String(artifact.sourceReference.canonicalUrl)
      : null;
  return Object.freeze({
    kind: "source_artifact",
    sourceArtifactId: text(artifact?.sourceArtifactId) || null,
    sourceKind: text(artifact?.sourceKind) || "source",
    displayName: text(artifact?.sourceReference?.title || artifact?.originalName || artifact?.sourceKind || "Source"),
    canonicalUrl,
    mimeType: text(artifact?.mimeType) || null,
    byteSize: Number.isFinite(Number(artifact?.byteSize)) ? Math.max(0, Number(artifact.byteSize)) : null,
    extractionState: text(artifact?.extraction?.state) || null,
    extractionChars: Number.isFinite(Number(artifact?.extraction?.charCount))
      ? Math.max(0, Number(artifact.extraction.charCount))
      : null,
    truncated: artifact?.extraction?.truncated === true,
    usabilityState: text(artifact?.usability?.state) || null,
    evidenceState: text(artifact?.usability?.evidenceState) || null,
    status,
    issueCode,
    recoveryAction: recoveryAction(status, issueCode),
  });
}

function usableArtifact(artifact) {
  return artifact?.usability?.state === "usable_evidence"
    && artifact?.usability?.evidenceState === "verified";
}

function linkResultEntry(result) {
  const rawStatus = String(result?.status || "");
  const status = result?.evidenceUsable === true
    ? result?.extractionStatus === "truncated"
      ? SOURCE_HEALTH_ENTRY_STATUSES.TRUNCATED
      : SOURCE_HEALTH_ENTRY_STATUSES.USABLE
    : rawStatus === "reference_only"
      ? SOURCE_HEALTH_ENTRY_STATUSES.REFERENCE_ONLY
      : rawStatus === "unsupported"
        ? SOURCE_HEALTH_ENTRY_STATUSES.UNSUPPORTED
        : rawStatus === "blocked_for_safety"
          ? SOURCE_HEALTH_ENTRY_STATUSES.BLOCKED
          : SOURCE_HEALTH_ENTRY_STATUSES.FAILED;
  const issueCode = result?.issueCodes?.[0] || null;
  return Object.freeze({
    kind: "link",
    sourceKind: "link",
    displayName: result?.title || result?.finalCanonicalUrl || result?.canonicalUrl || "Public link",
    canonicalUrl: result?.finalCanonicalUrl || result?.canonicalUrl || null,
    status,
    issueCode,
    mimeType: result?.mimeType || null,
    encodedBytes: Number.isFinite(Number(result?.encodedBytes)) ? Math.max(0, Number(result.encodedBytes)) : null,
    decodedBytes: Number.isFinite(Number(result?.decodedBytes)) ? Math.max(0, Number(result.decodedBytes)) : null,
    extractionChars: Number.isFinite(Number(result?.extractedChars)) ? Math.max(0, Number(result.extractedChars)) : null,
    extractionState: result?.extractionStatus || null,
    truncated: result?.extractionStatus === "truncated",
    redirectCount: Number.isFinite(Number(result?.redirectCount)) ? Math.max(0, Number(result.redirectCount)) : 0,
    recoveryAction: recoveryAction(status, issueCode),
  });
}

export function createSourceHealthReport({
  notes = "",
  repoUrl = "",
  repoContext = null,
  documentText = [],
  sourceArtifacts = [],
  linkCandidates = [],
  linkResults = null,
  verificationComplete = false,
} = {}) {
  const entries = [];
  if (text(notes)) {
    entries.push(Object.freeze({
      kind: "notes",
      sourceKind: "note",
      displayName: "Campaign brief",
      status: SOURCE_HEALTH_ENTRY_STATUSES.USABLE,
      issueCode: null,
      recoveryAction: "",
    }));
  }

  const documents = normalizeDocuments(documentText);
  for (let index = 0; index < documents.length; index += 1) {
    entries.push(Object.freeze({
      kind: "document",
      sourceKind: "upload",
      displayName: `Extracted document ${index + 1}`,
      status: SOURCE_HEALTH_ENTRY_STATUSES.USABLE,
      issueCode: null,
      recoveryAction: "",
      index,
    }));
  }

  for (const artifact of Array.isArray(sourceArtifacts) ? sourceArtifacts : []) {
    if (Array.isArray(linkResults) && artifact?.sourceKind === "link") continue;
    entries.push(safeArtifactEntry(artifact));
  }

  if (text(repoUrl)) {
    const parsedRepository = parseGitHubUrl(text(repoUrl));
    const status = !parsedRepository
      ? SOURCE_HEALTH_ENTRY_STATUSES.INVALID
      : repoContext
        ? SOURCE_HEALTH_ENTRY_STATUSES.USABLE
        : verificationComplete
          ? SOURCE_HEALTH_ENTRY_STATUSES.FAILED
          : SOURCE_HEALTH_ENTRY_STATUSES.NEEDS_VERIFICATION;
    const issueCode = !parsedRepository
      ? "invalid_repository"
      : repoContext
        ? null
        : verificationComplete
          ? "repository_unavailable"
          : null;
    entries.push(Object.freeze({
      kind: "repository",
      sourceKind: "repository",
      displayName: parsedRepository ? `${parsedRepository.owner}/${parsedRepository.repo}` : "Repository",
      canonicalUrl: parsedRepository?.canonicalUrl || null,
      status,
      issueCode,
      selectedFileCount: Array.isArray(repoContext?.files) ? repoContext.files.length : null,
      recoveryAction: recoveryAction(status, issueCode),
    }));
  }

  const candidateEntries = Array.isArray(linkCandidates)
    ? linkCandidates
    : parseSourceLinkCandidates(linkCandidates);
  if (Array.isArray(linkResults)) {
    for (const result of linkResults) entries.push(linkResultEntry(result));
    for (const candidate of candidateEntries) {
      if ([SOURCE_HEALTH_ENTRY_STATUSES.INVALID, SOURCE_HEALTH_ENTRY_STATUSES.DUPLICATE].includes(candidate.status)) {
        entries.push(candidate);
      }
    }
  } else {
    entries.push(...candidateEntries);
  }

  const counts = Object.freeze({
    usable: entries.filter((item) => [SOURCE_HEALTH_ENTRY_STATUSES.USABLE, SOURCE_HEALTH_ENTRY_STATUSES.TRUNCATED].includes(item.status)).length,
    needsVerification: entries.filter((item) => item.status === SOURCE_HEALTH_ENTRY_STATUSES.NEEDS_VERIFICATION).length,
    referenceOnly: entries.filter((item) => item.status === SOURCE_HEALTH_ENTRY_STATUSES.REFERENCE_ONLY).length,
    processing: entries.filter((item) => item.status === SOURCE_HEALTH_ENTRY_STATUSES.PROCESSING).length,
    failed: entries.filter((item) => item.status === SOURCE_HEALTH_ENTRY_STATUSES.FAILED).length,
    unsupported: entries.filter((item) => item.status === SOURCE_HEALTH_ENTRY_STATUSES.UNSUPPORTED).length,
    blocked: entries.filter((item) => item.status === SOURCE_HEALTH_ENTRY_STATUSES.BLOCKED).length,
    truncated: entries.filter((item) => item.status === SOURCE_HEALTH_ENTRY_STATUSES.TRUNCATED).length,
    stale: entries.filter((item) => item.status === SOURCE_HEALTH_ENTRY_STATUSES.STALE).length,
    invalid: entries.filter((item) => item.status === SOURCE_HEALTH_ENTRY_STATUSES.INVALID).length,
    duplicate: entries.filter((item) => item.status === SOURCE_HEALTH_ENTRY_STATUSES.DUPLICATE).length,
  });

  const hasCandidates = entries.length > 0;
  const status = counts.usable > 0
    ? SOURCE_HEALTH_STATUSES.READY
    : (counts.needsVerification > 0 || counts.processing > 0) && !verificationComplete
      ? SOURCE_HEALTH_STATUSES.NEEDS_VERIFICATION
      : SOURCE_HEALTH_STATUSES.BLOCKED;

  const reason = status === SOURCE_HEALTH_STATUSES.READY
    ? "At least one source is verified usable evidence."
    : status === SOURCE_HEALTH_STATUSES.NEEDS_VERIFICATION
      ? "Sources still need server verification or processing before they can count as evidence."
      : hasCandidates
        ? "No supplied source became usable evidence."
        : "Add a brief, repository, supported text source, or public link.";

  return Object.freeze({
    schemaVersion: SOURCE_HEALTH_REPORT_VERSION,
    status,
    readyForGeneration: status === SOURCE_HEALTH_STATUSES.READY,
    canAttemptVerification: status === SOURCE_HEALTH_STATUSES.NEEDS_VERIFICATION,
    reason,
    counts,
    entries: Object.freeze(entries),
  });
}
