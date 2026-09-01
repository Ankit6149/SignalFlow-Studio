import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import { createDeterministicIdService } from "../lib/domain/ports.mjs";
import { createSourceConnectionApplication } from "../lib/application/sourceConnectionApplication.mjs";
import { createGithubSignalIngestionApplication } from "../lib/application/githubSignalIngestionApplication.mjs";
import { createMemorySourceConnectionRepository } from "../lib/infrastructure/sourceConnectionAdapters.mjs";
import { createMemoryContentSignalRepository } from "../lib/infrastructure/contentSignalAdapters.mjs";
import { verifyGithubWebhookSignature } from "../lib/server/githubWebhookSecurity.mjs";

const WORKSPACE_ID = "workspace-owner";
const NOW = "2026-08-18T18:10:00.000Z";
const PR_REVISION = "a".repeat(40);
const RELEASE_REVISION = "b".repeat(40);
const clock = { now: () => NOW };

function mergedPullRequestPayload({
  repositoryId = 3001,
  installationId = 9001,
  pullRequestId = 7001,
  number = 42,
  title = "feat: add approval history",
  author = "owner",
  sender = "owner",
  mergeCommitSha = PR_REVISION,
  headSha = "c".repeat(40),
} = {}) {
  return {
    action: "closed",
    installation: { id: installationId },
    repository: {
      id: repositoryId,
      full_name: "private-owner/private-repo",
      clone_url: "https://example.invalid/private-owner/private-repo.git",
    },
    sender: { login: sender },
    number,
    pull_request: {
      id: pullRequestId,
      number,
      title,
      body: "PRIVATE BODY THAT MUST NOT BE COPIED INTO THE SIGNAL",
      merged: true,
      merge_commit_sha: mergeCommitSha,
      head: { sha: headSha },
      merged_at: "2026-08-18T17:55:00.000Z",
      changed_files: 8,
      additions: 120,
      deletions: 31,
      user: { login: author },
      labels: [{ name: "feature" }],
      patch_url: "https://example.invalid/private.patch?token=do-not-store",
    },
    authorization: "Bearer do-not-store",
  };
}

function publishedReleasePayload({
  repositoryId = 3001,
  installationId = 9001,
  targetCommitish = RELEASE_REVISION,
} = {}) {
  return {
    action: "published",
    installation: { id: installationId },
    repository: { id: repositoryId, full_name: "private-owner/private-repo" },
    release: {
      id: 8101,
      name: "Revision judgment",
      tag_name: "v0.3.0",
      target_commitish: targetCommitish,
      body: "PRIVATE RELEASE BODY THAT MUST NOT BE COPIED",
      published_at: "2026-08-18T18:00:00.000Z",
    },
  };
}

async function setupConnection({ eventFamilies = ["pull_request_merged", "release_published"] } = {}) {
  const sourceConnectionRepository = createMemorySourceConnectionRepository();
  const contentSignalRepository = createMemoryContentSignalRepository();
  const idService = createDeterministicIdService("github-core");
  const connectionApplication = createSourceConnectionApplication({
    sourceConnectionRepository,
    workspaceId: WORKSPACE_ID,
    clock,
    idService,
  });
  const created = await connectionApplication.createConnection({
    provider: "github",
    providerAccountRef: "account-55",
    installationRef: "9001",
    credentialRef: "credential-ref-github-owner",
    permissionScopes: ["metadata:read", "pull_requests:read"],
    capabilities: ["webhook_events"],
    resourceScopes: [{
      resourceRef: "3001",
      resourceType: "repository",
      displayName: "private-repo",
      projectId: "project-signalflow",
      eventFamilies,
      enabled: true,
    }],
  });
  const connection = await connectionApplication.markVerified(created.sourceConnectionId);
  const ingestion = createGithubSignalIngestionApplication({
    sourceConnectionRepository,
    contentSignalRepository,
    workspaceId: WORKSPACE_ID,
    clock,
    idService,
  });
  return { sourceConnectionRepository, contentSignalRepository, connectionApplication, connection, ingestion };
}

test("GitHub webhook signature verification uses the raw body and fails closed", () => {
  const secret = "test-webhook-secret";
  const rawBody = Buffer.from('{"action":"closed","number":42}', "utf8");
  const signatureHeader = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;

  assert.equal(verifyGithubWebhookSignature({ rawBody, signatureHeader, secret }), true);
  assert.equal(verifyGithubWebhookSignature({ rawBody: Buffer.from('{"action":"closed","number":43}'), signatureHeader, secret }), false);
  assert.equal(verifyGithubWebhookSignature({ rawBody, signatureHeader: "sha256=bad", secret }), false);
  assert.throws(() => verifyGithubWebhookSignature({ rawBody, signatureHeader }), /configured secret/i);
});

test("verified merged PR creates one canonical GitHub ContentSignal and duplicate delivery is idempotent", async () => {
  const { ingestion, contentSignalRepository, connectionApplication, connection } = await setupConnection();
  const payload = mergedPullRequestPayload();

  const first = await ingestion.ingest({ eventName: "pull_request", deliveryId: "delivery-pr-42", payload });
  const duplicate = await ingestion.ingest({ eventName: "pull_request", deliveryId: "delivery-pr-42", payload });

  assert.equal(first.status, "created");
  assert.equal(duplicate.status, "duplicate");
  assert.equal(first.shouldEvaluateOpportunity, true);
  assert.equal(first.signal.signalId, duplicate.signal.signalId);
  assert.equal(first.signal.sourceType, "github");
  assert.equal(first.signal.sourceConnectionId, connection.sourceConnectionId);
  assert.equal(first.signal.sourceRevision, PR_REVISION);
  assert.equal(first.signal.projectId, "project-signalflow");
  assert.equal(first.signal.externalEventRef.provider, "github");
  assert.equal(first.signal.externalEventRef.eventId, "delivery-pr-42");
  assert.equal(first.signal.externalEventRef.idempotencyKey, "github:delivery-pr-42");
  assert.equal(first.signal.signalKind, "feature");
  assert.deepEqual(first.signal.importanceHints, ["event:merged_pull_request", "work:completed"]);
  assert.match(first.signal.summary, /8 files, 120 additions, 31 deletions/);

  const stored = await contentSignalRepository.list();
  assert.equal(stored.length, 1);
  const serialized = JSON.stringify(stored[0]);
  assert.doesNotMatch(serialized, /PRIVATE BODY|private\.patch|do-not-store|authorization/i);
  assert.doesNotMatch(serialized, /private-owner\/private-repo/);

  const updatedConnection = await connectionApplication.readConnection(connection.sourceConnectionId);
  assert.equal(updatedConnection.lastEventAt, "2026-08-18T17:55:00.000Z");
});

test("merged PR never substitutes feature-branch head SHA for missing merge commit evidence", async () => {
  const { ingestion } = await setupConnection();
  const result = await ingestion.ingest({
    eventName: "pull_request",
    deliveryId: "delivery-pr-no-merge-revision",
    payload: mergedPullRequestPayload({ mergeCommitSha: null, headSha: "d".repeat(40) }),
  });

  assert.equal(result.status, "created");
  assert.equal(result.signal.sourceRevision, null);
  assert.equal(result.shouldEvaluateOpportunity, false, "unresolved merged state is auditable but cannot become an evidence-backed Opportunity");
});

test("dependency-only PR is preserved as a signal but skipped by the cheap opportunity gate", async () => {
  const { ingestion, contentSignalRepository } = await setupConnection();
  const payload = mergedPullRequestPayload({
    pullRequestId: 7002,
    number: 43,
    title: "Bump next from 16.2.10 to 16.2.11",
    author: "dependabot[bot]",
    sender: "dependabot[bot]",
  });

  const result = await ingestion.ingest({ eventName: "pull_request", deliveryId: "delivery-deps-43", payload });
  assert.equal(result.status, "created");
  assert.equal(result.noiseDecision.deprioritize, true);
  assert.equal(result.noiseDecision.reason, "dependency_only_change");
  assert.equal(result.shouldEvaluateOpportunity, false);
  assert.deepEqual(result.signal.importanceHints, ["analysis:deprioritize", "noise:dependency_only"]);
  assert.equal((await contentSignalRepository.list()).length, 1, "noise remains auditable without becoming an expensive content opportunity");
});

test("published release with an exact commit uses the same provider-neutral connection and canonical signal path", async () => {
  const { ingestion } = await setupConnection();
  const result = await ingestion.ingest({
    eventName: "release",
    deliveryId: "delivery-release-1",
    payload: publishedReleasePayload(),
  });

  assert.equal(result.status, "created");
  assert.equal(result.eventFamily, "release_published");
  assert.equal(result.signal.signalKind, "release");
  assert.equal(result.signal.headline, "Revision judgment");
  assert.equal(result.signal.sourceRevision, RELEASE_REVISION);
  assert.equal(result.shouldEvaluateOpportunity, true);
});

test("release branch names remain auditable signals but are not promoted until an exact revision is available", async () => {
  const { ingestion } = await setupConnection();
  const result = await ingestion.ingest({
    eventName: "release",
    deliveryId: "delivery-release-unresolved",
    payload: publishedReleasePayload({ targetCommitish: "master" }),
  });

  assert.equal(result.status, "created");
  assert.equal(result.signal.sourceRevision, null);
  assert.equal(result.shouldEvaluateOpportunity, false);
});

test("unmapped, disabled, paused and revoked repository scopes fail closed", async () => {
  const { ingestion, connectionApplication, connection } = await setupConnection({ eventFamilies: ["release_published"] });

  await assert.rejects(
    () => ingestion.ingest({ eventName: "pull_request", deliveryId: "delivery-denied-event-family", payload: mergedPullRequestPayload() }),
    (error) => error?.code === "github_source_not_authorized",
  );

  await assert.rejects(
    () => ingestion.ingest({ eventName: "release", deliveryId: "delivery-wrong-repo", payload: publishedReleasePayload({ repositoryId: 9999 }) }),
    (error) => error?.code === "github_source_not_authorized",
  );

  await connectionApplication.pauseConnection(connection.sourceConnectionId);
  await assert.rejects(
    () => ingestion.ingest({ eventName: "release", deliveryId: "delivery-paused", payload: publishedReleasePayload() }),
    (error) => error?.code === "github_source_not_authorized",
  );

  await connectionApplication.resumeConnection(connection.sourceConnectionId);
  await connectionApplication.revokeConnection(connection.sourceConnectionId);
  await assert.rejects(
    () => ingestion.ingest({ eventName: "release", deliveryId: "delivery-revoked", payload: publishedReleasePayload() }),
    (error) => error?.code === "github_source_not_authorized",
  );
});

test("unsupported GitHub events are ignored without creating a ContentSignal", async () => {
  const { ingestion, contentSignalRepository } = await setupConnection();
  const result = await ingestion.ingest({
    eventName: "issues",
    deliveryId: "delivery-issues-1",
    payload: { action: "opened", installation: { id: 9001 }, repository: { id: 3001 } },
  });
  assert.equal(result.status, "ignored_unsupported");
  assert.equal(result.shouldEvaluateOpportunity, false);
  assert.equal((await contentSignalRepository.list()).length, 0);
});
