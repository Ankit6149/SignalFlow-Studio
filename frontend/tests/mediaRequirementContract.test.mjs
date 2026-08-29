import test from "node:test";
import assert from "node:assert/strict";

import { DOMAIN_SCHEMA_VERSION, createDomainRecord, parseDomainRecord } from "../lib/domain/contracts.mjs";
import {
  MEDIA_DECISION_KINDS,
  MEDIA_REQUIREMENT_STATUSES,
  normalizeMediaRequirement,
  planMediaForContentPiece,
} from "../lib/domain/mediaIntelligence.mjs";

const NOW = "2026-08-30T00:00:00.000Z";

function requirementInput(overrides = {}) {
  return {
    mediaRequirementId: "requirement-1",
    workspaceId: "workspace-1",
    contentPieceId: "piece-1",
    destination: "linkedin",
    mediaKind: MEDIA_DECISION_KINDS.NONE,
    purpose: "Prove the content claim without weakening authenticity.",
    status: MEDIA_REQUIREMENT_STATUSES.SATISFIED,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function contentPiece(overrides = {}) {
  return {
    contentPieceId: "piece-1",
    workspaceId: "workspace-1",
    purpose: "Explain a product architecture change clearly.",
    canonicalIntent: "Show the real product state behind the claim.",
    claims: ["Approval binds an exact revision"],
    ...overrides,
  };
}

test("domain constructors own schemaVersion and kind even when payloads try to override them", () => {
  const record = createDomainRecord("MediaRequirement", requirementInput({
    schemaVersion: 999,
    kind: MEDIA_DECISION_KINDS.PRODUCT_SCREENSHOT,
    mediaKind: MEDIA_DECISION_KINDS.PRODUCT_SCREENSHOT,
    status: MEDIA_REQUIREMENT_STATUSES.PLANNED,
  }));

  assert.equal(record.schemaVersion, DOMAIN_SCHEMA_VERSION);
  assert.equal(record.kind, "MediaRequirement");
  assert.equal(record.mediaKind, MEDIA_DECISION_KINDS.PRODUCT_SCREENSHOT);
  assert.equal(parseDomainRecord(record, "MediaRequirement").kind, "MediaRequirement");
});

test("legacy raw media requirements migrate selected kind into mediaKind without corrupting identity", () => {
  const record = normalizeMediaRequirement(requirementInput({
    mediaKind: undefined,
    kind: MEDIA_DECISION_KINDS.PRODUCT_SCREENSHOT,
    status: MEDIA_REQUIREMENT_STATUSES.PLANNED,
    productionReadiness: "needs_capture",
  }));

  assert.equal(record.kind, "MediaRequirement");
  assert.equal(record.mediaKind, MEDIA_DECISION_KINDS.PRODUCT_SCREENSHOT);
  assert.equal(record.productionReadiness, "needs_capture");
});

test("canonical media requirements round-trip through normalization", () => {
  const original = normalizeMediaRequirement(requirementInput({
    mediaKind: MEDIA_DECISION_KINDS.EXISTING_SINGLE_IMAGE,
    status: MEDIA_REQUIREMENT_STATUSES.PLANNED,
    productionReadiness: "ready",
  }));
  const roundTrip = normalizeMediaRequirement(original);

  assert.equal(roundTrip.kind, "MediaRequirement");
  assert.equal(roundTrip.mediaKind, MEDIA_DECISION_KINDS.EXISTING_SINGLE_IMAGE);
  assert.equal(roundTrip.mediaRequirementId, original.mediaRequirementId);
});

test("planning keeps record identity stable while NONE and screenshot remain distinct media kinds", () => {
  const nonePlan = planMediaForContentPiece({
    mediaDecisionId: "decision-none",
    contentPiece: contentPiece(),
    destinations: ["linkedin"],
    visualPotential: 0.1,
    productEvidence: false,
    createdAt: NOW,
  });
  const screenshotPlan = planMediaForContentPiece({
    mediaDecisionId: "decision-shot",
    contentPiece: contentPiece(),
    destinations: ["linkedin"],
    visualPotential: 1,
    productEvidence: true,
    createdAt: NOW,
  });

  assert.equal(nonePlan.requirements[0].kind, "MediaRequirement");
  assert.equal(nonePlan.requirements[0].mediaKind, MEDIA_DECISION_KINDS.NONE);
  assert.equal(nonePlan.requirements[0].status, MEDIA_REQUIREMENT_STATUSES.SATISFIED);

  assert.equal(screenshotPlan.requirements[0].kind, "MediaRequirement");
  assert.equal(screenshotPlan.requirements[0].mediaKind, MEDIA_DECISION_KINDS.PRODUCT_SCREENSHOT);
  assert.equal(screenshotPlan.requirements[0].productionReadiness, "needs_capture");
});
