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
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
      return Object.freeze({ ok: false, code: "invalid_link", canonicalUrl: null });
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
        input: token,
        canonicalUrl: null,
        status: SOURCE_HEALTH_ENTRY_STATUSES.INVALID,
        issueCode: normalized.code,
      }));
      continue;
    }
    if (seen.has(normalized.canonicalUrl)) {
      entries.push(Object.freeze({
        kind: "link",
        input: token,
        canonicalUrl: normalized.canonicalUrl,
        status: SOURCE_HEALTH_ENTRY_STATUSES.DUPLICATE,
        issueCode: "duplicate_link",
      }));
      continue;
    }
    seen.add(normalized.canonicalUrl);
    entries.push(Object.freeze({
      kind: "link",
      input: token,
      canonicalUrl: normalized.canonicalUrl,
      status: SOURCE_HEALTH_ENTRY_STATUSES.NEEDS_VERIFICATION,
      issueCode: null,
    }));
  }
  return Object.freeze(entries);
}

function usableArtifact(artifact) {
  return artifact?.usability?.state === "usable_evidence"
    && artifact?.usability?.evidenceState === "verified";
}

function linkResultEntry(result) {
  const status = result?.evidenceUsable === true
    ? SOURCE_HEALTH_ENTRY_STATUSES.USABLE
    : result?.status === "reference_only"
      ? SOURCE_HEALTH_ENTRY_STATUSES.REFERENCE_ONLY
      : SOURCE_HEALTH_ENTRY_STATUSES.FAILED;
  return Object.freeze({
    kind: "link",
    canonicalUrl: result?.finalCanonicalUrl || result?.canonicalUrl || null,
    status,
    issueCode: result?.issueCodes?.[0] || null,
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
    entries.push(Object.freeze({ kind: "notes", status: SOURCE_HEALTH_ENTRY_STATUSES.USABLE, issueCode: null }));
  }

  const documents = normalizeDocuments(documentText);
  for (let index = 0; index < documents.length; index += 1) {
    entries.push(Object.freeze({
      kind: "document",
      status: SOURCE_HEALTH_ENTRY_STATUSES.USABLE,
      issueCode: null,
      index,
    }));
  }

  for (const artifact of Array.isArray(sourceArtifacts) ? sourceArtifacts : []) {
    entries.push(Object.freeze({
      kind: "source_artifact",
      sourceArtifactId: text(artifact?.sourceArtifactId) || null,
      status: usableArtifact(artifact)
        ? SOURCE_HEALTH_ENTRY_STATUSES.USABLE
        : artifact?.usability?.state === "reference_only"
          ? SOURCE_HEALTH_ENTRY_STATUSES.REFERENCE_ONLY
          : SOURCE_HEALTH_ENTRY_STATUSES.FAILED,
      issueCode: artifact?.usability?.issueCodes?.[0] || null,
    }));
  }

  if (text(repoUrl)) {
    entries.push(Object.freeze({
      kind: "repository",
      status: repoContext
        ? SOURCE_HEALTH_ENTRY_STATUSES.USABLE
        : verificationComplete
          ? SOURCE_HEALTH_ENTRY_STATUSES.FAILED
          : SOURCE_HEALTH_ENTRY_STATUSES.NEEDS_VERIFICATION,
      issueCode: repoContext ? null : verificationComplete ? "repository_unavailable" : null,
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
    usable: entries.filter((item) => item.status === SOURCE_HEALTH_ENTRY_STATUSES.USABLE).length,
    needsVerification: entries.filter((item) => item.status === SOURCE_HEALTH_ENTRY_STATUSES.NEEDS_VERIFICATION).length,
    referenceOnly: entries.filter((item) => item.status === SOURCE_HEALTH_ENTRY_STATUSES.REFERENCE_ONLY).length,
    failed: entries.filter((item) => item.status === SOURCE_HEALTH_ENTRY_STATUSES.FAILED).length,
    invalid: entries.filter((item) => item.status === SOURCE_HEALTH_ENTRY_STATUSES.INVALID).length,
    duplicate: entries.filter((item) => item.status === SOURCE_HEALTH_ENTRY_STATUSES.DUPLICATE).length,
  });

  const hasCandidates = entries.length > 0;
  const status = counts.usable > 0
    ? SOURCE_HEALTH_STATUSES.READY
    : counts.needsVerification > 0 && !verificationComplete
      ? SOURCE_HEALTH_STATUSES.NEEDS_VERIFICATION
      : SOURCE_HEALTH_STATUSES.BLOCKED;

  const reason = status === SOURCE_HEALTH_STATUSES.READY
    ? "At least one source is verified usable evidence."
    : status === SOURCE_HEALTH_STATUSES.NEEDS_VERIFICATION
      ? "Remote or repository sources must be verified by the server before they can count as evidence."
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
