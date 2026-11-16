import test from "node:test";
import assert from "node:assert/strict";

import { prepareRemoteLinkEvidence } from "../lib/source/generationSourcePreparation.mjs";
import {
  createSourceHealthReport,
  SOURCE_HEALTH_STATUSES,
} from "../lib/source/sourceHealth.mjs";

const HASH = "a".repeat(64);

function usableResult(url = "https://example.com/docs") {
  return Object.freeze({
    schemaVersion: 1,
    status: "usable_evidence",
    canonicalUrl: url,
    finalCanonicalUrl: url,
    httpStatus: 200,
    mimeType: "text/html",
    encodedBytes: 128,
    decodedBytes: 128,
    extractedChars: 42,
    extractionStatus: "complete",
    evidenceUsable: true,
    title: "Example docs",
    description: "Verified public source",
    text: "A concrete implementation detail from public docs.",
    contentHash: HASH,
    issueCodes: Object.freeze([]),
    issues: Object.freeze([]),
    redirectCount: 0,
    timing: Object.freeze({ durationMs: 4 }),
    warnings: Object.freeze([]),
  });
}

function failedResult(url = "https://example.com/dead") {
  return Object.freeze({
    schemaVersion: 1,
    status: "timed_out",
    canonicalUrl: url,
    finalCanonicalUrl: null,
    httpStatus: null,
    mimeType: null,
    encodedBytes: 0,
    decodedBytes: 0,
    extractedChars: 0,
    extractionStatus: "not_available",
    evidenceUsable: false,
    title: "",
    description: "",
    text: "",
    contentHash: null,
    issueCodes: Object.freeze(["source_fetch_timeout"]),
    issues: Object.freeze([{ code: "source_fetch_timeout", message: "Remote source fetch timed out." }]),
    redirectCount: 0,
    timing: Object.freeze({ durationMs: 8000 }),
    warnings: Object.freeze(["Remote source fetch timed out."]),
  });
}

test("links-only preparation deduplicates, creates verified canonical evidence, and finalizes ready", async () => {
  const calls = [];
  const prepared = await prepareRemoteLinkEvidence({
    docsUrl: "https://example.com/docs?b=2&a=1 https://example.com/docs?a=1&b=2",
    sourceWorkspaceId: "workspace-links",
    canonicalSources: { assets: [], sourceArtifacts: [], processingRecords: [] },
    fetchUrlContentImpl: async (url) => {
      calls.push(url);
      return usableResult(url);
    },
  });

  assert.equal(calls.length, 1, "duplicate canonical links must be fetched once");
  assert.equal(prepared.linksContext.length, 1);
  assert.equal(prepared.linkFetchResults.length, 1);
  assert.equal(prepared.canonicalSources.sourceArtifacts.length, 1);

  const artifact = prepared.canonicalSources.sourceArtifacts[0];
  assert.equal(artifact.sourceKind, "link");
  assert.equal(artifact.sourceReference.safetyVerification, "verified");
  assert.equal(artifact.usability.state, "usable_evidence");
  assert.equal(artifact.usability.evidenceState, "verified");

  const final = createSourceHealthReport({
    sourceArtifacts: prepared.canonicalSources.sourceArtifacts,
    linkCandidates: prepared.linkCandidates,
    linkResults: prepared.linkFetchResults,
    verificationComplete: true,
  });
  assert.equal(final.status, SOURCE_HEALTH_STATUSES.READY);
  assert.equal(final.readyForGeneration, true);
  assert.equal(final.counts.usable, 1);
  assert.equal(final.counts.duplicate, 1);
});

test("links-only preparation with no usable fetch result finalizes blocked before model eligibility", async () => {
  let calls = 0;
  const prepared = await prepareRemoteLinkEvidence({
    docsUrl: "https://example.com/dead",
    sourceWorkspaceId: "workspace-links",
    canonicalSources: { assets: [], sourceArtifacts: [], processingRecords: [] },
    fetchUrlContentImpl: async (url) => {
      calls += 1;
      return failedResult(url);
    },
  });

  assert.equal(calls, 1);
  assert.equal(prepared.linksContext.length, 0);
  assert.equal(prepared.canonicalSources.sourceArtifacts.length, 0);
  assert.deepEqual(prepared.warnings, ["Remote source fetch timed out."]);

  const final = createSourceHealthReport({
    sourceArtifacts: prepared.canonicalSources.sourceArtifacts,
    linkCandidates: prepared.linkCandidates,
    linkResults: prepared.linkFetchResults,
    verificationComplete: true,
  });
  assert.equal(final.status, SOURCE_HEALTH_STATUSES.BLOCKED);
  assert.equal(final.readyForGeneration, false);
  assert.equal(final.counts.failed, 1);
  assert.equal(final.entries[0].issueCode, "source_fetch_timeout");
});

test("mixed preparation preserves usable canonical evidence while surfacing a failed remote link", async () => {
  const prepared = await prepareRemoteLinkEvidence({
    docsUrl: "https://example.com/dead",
    sourceWorkspaceId: "workspace-links",
    canonicalSources: { assets: [], sourceArtifacts: [], processingRecords: [] },
    fetchUrlContentImpl: async (url) => failedResult(url),
  });

  const final = createSourceHealthReport({
    notes: "Known first-party implementation evidence.",
    sourceArtifacts: prepared.canonicalSources.sourceArtifacts,
    linkCandidates: prepared.linkCandidates,
    linkResults: prepared.linkFetchResults,
    verificationComplete: true,
  });
  assert.equal(final.status, SOURCE_HEALTH_STATUSES.READY);
  assert.equal(final.counts.usable, 1);
  assert.equal(final.counts.failed, 1);
});
