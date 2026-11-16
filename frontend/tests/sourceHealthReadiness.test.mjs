import test from "node:test";
import assert from "node:assert/strict";

import {
  createSourceHealthReport,
  normalizeSourceLinkCandidate,
  parseSourceLinkCandidates,
  SOURCE_HEALTH_ENTRY_STATUSES,
  SOURCE_HEALTH_STATUSES,
} from "../lib/source/sourceHealth.mjs";
import { validateGenerationInputs } from "../lib/package/validatePackage.js";

function verifiedArtifact(overrides = {}) {
  return {
    sourceArtifactId: "artifact-verified",
    sourceKind: "upload",
    usability: {
      state: "usable_evidence",
      evidenceState: "verified",
      issueCodes: [],
    },
    ...overrides,
  };
}

function linkResult(overrides = {}) {
  return {
    status: "usable_evidence",
    evidenceUsable: true,
    canonicalUrl: "https://example.com/docs",
    finalCanonicalUrl: "https://example.com/docs",
    issueCodes: [],
    ...overrides,
  };
}

test("links-only input is a verification candidate before fetch, not fake usable evidence", () => {
  const validation = validateGenerationInputs({
    docs_url: "https://example.com/docs",
    channels: ["linkedin"],
  });
  assert.equal(validation.valid, true);
  assert.equal(validation.sourceHealth.status, SOURCE_HEALTH_STATUSES.NEEDS_VERIFICATION);
  assert.equal(validation.sourceHealth.readyForGeneration, false);
  assert.equal(validation.sourceHealth.canAttemptVerification, true);
  assert.equal(validation.sourceHealth.counts.usable, 0);
  assert.equal(validation.sourceHealth.counts.needsVerification, 1);
});

test("verified links-only input becomes ready after server fetch result", () => {
  const candidates = parseSourceLinkCandidates("https://example.com/docs");
  const report = createSourceHealthReport({
    linkCandidates: candidates,
    linkResults: [linkResult()],
    verificationComplete: true,
  });
  assert.equal(report.status, SOURCE_HEALTH_STATUSES.READY);
  assert.equal(report.readyForGeneration, true);
  assert.equal(report.counts.usable, 1);
  assert.equal(report.entries[0].kind, "link");
});

test("failed or reference-only links-only input blocks before generation with safe reasons", () => {
  const candidates = parseSourceLinkCandidates("https://example.com/a https://example.com/b");
  const report = createSourceHealthReport({
    linkCandidates: candidates,
    linkResults: [
      linkResult({
        status: "blocked_for_safety",
        evidenceUsable: false,
        finalCanonicalUrl: null,
        canonicalUrl: "https://example.com/a",
        issueCodes: ["unsafe_dns_answer"],
      }),
      linkResult({
        status: "reference_only",
        evidenceUsable: false,
        canonicalUrl: "https://example.com/b",
        finalCanonicalUrl: "https://example.com/b",
        issueCodes: ["empty_extraction"],
      }),
    ],
    verificationComplete: true,
  });
  assert.equal(report.status, SOURCE_HEALTH_STATUSES.BLOCKED);
  assert.equal(report.readyForGeneration, false);
  assert.equal(report.counts.failed, 1);
  assert.equal(report.counts.referenceOnly, 1);
  assert.match(report.reason, /no supplied source became usable evidence/i);
});

test("notes, repository, documents, and canonical SourceArtifacts share one readiness contract", () => {
  const notes = createSourceHealthReport({ notes: "A concrete implementation note." });
  assert.equal(notes.status, SOURCE_HEALTH_STATUSES.READY);

  const repositoryBefore = createSourceHealthReport({
    repoUrl: "https://github.com/Ankit6149/SignalFlow-Studio",
    verificationComplete: false,
  });
  assert.equal(repositoryBefore.status, SOURCE_HEALTH_STATUSES.NEEDS_VERIFICATION);

  const repositoryAfter = createSourceHealthReport({
    repoUrl: "https://github.com/Ankit6149/SignalFlow-Studio",
    repoContext: { name: "SignalFlow-Studio" },
    verificationComplete: true,
  });
  assert.equal(repositoryAfter.status, SOURCE_HEALTH_STATUSES.READY);

  const document = createSourceHealthReport({ documentText: ["Extracted source text"] });
  assert.equal(document.status, SOURCE_HEALTH_STATUSES.READY);

  const artifact = createSourceHealthReport({ sourceArtifacts: [verifiedArtifact()] });
  assert.equal(artifact.status, SOURCE_HEALTH_STATUSES.READY);
});

test("repository verification failure blocks repo-only generation", () => {
  const report = createSourceHealthReport({
    repoUrl: "https://github.com/Ankit6149/SignalFlow-Studio",
    repoContext: null,
    verificationComplete: true,
  });
  assert.equal(report.status, SOURCE_HEALTH_STATUSES.BLOCKED);
  assert.equal(report.entries[0].status, SOURCE_HEALTH_ENTRY_STATUSES.FAILED);
  assert.equal(report.entries[0].issueCode, "repository_unavailable");
});

test("mixed usable source stays ready while failed links remain visible", () => {
  const candidates = parseSourceLinkCandidates("https://example.com/dead");
  const report = createSourceHealthReport({
    notes: "Primary known evidence.",
    linkCandidates: candidates,
    linkResults: [linkResult({
      status: "timed_out",
      evidenceUsable: false,
      canonicalUrl: "https://example.com/dead",
      finalCanonicalUrl: null,
      issueCodes: ["source_fetch_timeout"],
    })],
    verificationComplete: true,
  });
  assert.equal(report.status, SOURCE_HEALTH_STATUSES.READY);
  assert.equal(report.counts.usable, 1);
  assert.equal(report.counts.failed, 1);
  assert.ok(report.entries.some((item) => item.issueCode === "source_fetch_timeout"));
});

test("duplicate links are normalized once and remain auditable without extra verification work", () => {
  const candidates = parseSourceLinkCandidates([
    "https://example.com/docs?b=2&a=1",
    "https://example.com/docs?a=1&b=2",
  ].join("\n"));
  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].status, SOURCE_HEALTH_ENTRY_STATUSES.NEEDS_VERIFICATION);
  assert.equal(candidates[1].status, SOURCE_HEALTH_ENTRY_STATUSES.DUPLICATE);
  assert.equal(candidates[0].canonicalUrl, candidates[1].canonicalUrl);

  const report = createSourceHealthReport({
    linkCandidates: candidates,
    linkResults: [linkResult({ canonicalUrl: candidates[0].canonicalUrl, finalCanonicalUrl: candidates[0].canonicalUrl })],
    verificationComplete: true,
  });
  assert.equal(report.status, SOURCE_HEALTH_STATUSES.READY);
  assert.equal(report.counts.usable, 1);
  assert.equal(report.counts.duplicate, 1);
});

test("invalid and credential-bearing links are blocked consistently during shared validation", () => {
  const invalid = validateGenerationInputs({ docs_url: "https://", channels: ["linkedin"] });
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join(" "), /invalid research\/docs link/i);

  const credential = validateGenerationInputs({
    docs_url: "https://example.com/file?X-Amz-Signature=secret",
    channels: ["linkedin"],
  });
  assert.equal(credential.valid, false);
  assert.match(credential.errors.join(" "), /credentials or signed access parameters/i);

  const normalized = normalizeSourceLinkCandidate("https://user:pass@example.com/private");
  assert.equal(normalized.ok, false);
});

test("ordinary invalid links are reported but do not block mixed usable evidence", () => {
  const validation = validateGenerationInputs({
    notes: "Known product evidence.",
    docs_url: "ftp://example.com/file https://example.com/docs",
    channels: ["linkedin"],
  });
  assert.equal(validation.valid, true);
  assert.equal(validation.sourceHealth.status, SOURCE_HEALTH_STATUSES.READY);
  assert.equal(validation.sourceHealth.counts.invalid, 1);
  assert.equal(validation.sourceHealth.counts.needsVerification, 1);
});

test("credential-bearing links remain blocking even when another source is usable", () => {
  const validation = validateGenerationInputs({
    notes: "Known product evidence.",
    docs_url: "https://example.com/private?token=secret",
    channels: ["linkedin"],
  });
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join(" "), /credentials or signed access parameters/i);
});

test("empty source payload is blocked by the same report used for links", () => {
  const validation = validateGenerationInputs({ channels: ["linkedin"] });
  assert.equal(validation.valid, false);
  assert.equal(validation.sourceHealth.status, SOURCE_HEALTH_STATUSES.BLOCKED);
  assert.match(validation.errors.join(" "), /add a brief, repository, supported text source, or public link/i);
});

test("reference-only canonical artifacts do not count as usable evidence", () => {
  const report = createSourceHealthReport({
    sourceArtifacts: [verifiedArtifact({
      sourceArtifactId: "artifact-reference",
      usability: {
        state: "reference_only",
        evidenceState: "unverified",
        issueCodes: ["no_extractable_text"],
      },
    })],
  });
  assert.equal(report.status, SOURCE_HEALTH_STATUSES.BLOCKED);
  assert.equal(report.counts.referenceOnly, 1);
});
