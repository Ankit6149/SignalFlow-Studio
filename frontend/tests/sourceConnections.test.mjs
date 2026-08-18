import test from "node:test";
import assert from "node:assert/strict";

import {
  createSourceConnection,
  SOURCE_CONNECTION_STATUSES,
  transitionSourceConnection,
  updateSourceConnection,
} from "../lib/domain/sourceConnections.mjs";

const CREATED_AT = "2026-08-18T10:00:00.000Z";

function pendingConnection(overrides = {}) {
  return createSourceConnection({
    sourceConnectionId: "source-connection-1",
    workspaceId: "workspace-1",
    provider: "github",
    installationRef: "installation-1",
    credentialRef: "credential-ref-github-owner",
    resourceScopes: [{
      resourceRef: "repository-1",
      eventFamilies: ["pull_request_merged"],
      enabled: true,
    }],
    createdAt: CREATED_AT,
    ...overrides,
  });
}

test("SourceConnection stores only a secret reference and rejects common raw credential shapes", () => {
  assert.equal(pendingConnection().credentialRef, "credential-ref-github-owner");

  for (const rawCredential of [
    "ghp_abcdefghijklmnopqrstuvwxyz0123456789",
    "github_pat_abcdefghijklmnopqrstuvwxyz",
    "Bearer abcdefghijklmnopqrstuvwxyz",
    "xoxb-1234567890-secret",
  ]) {
    assert.throws(
      () => pendingConnection({ credentialRef: rawCredential }),
      /must reference a secret stored outside the domain record|raw credential values are forbidden/i,
    );
  }
});

test("active SourceConnection requires verification and lifecycle keeps the verified timestamp", () => {
  assert.throws(
    () => pendingConnection({ status: SOURCE_CONNECTION_STATUSES.ACTIVE }),
    /requires verifiedAt/i,
  );

  const active = transitionSourceConnection(
    pendingConnection(),
    SOURCE_CONNECTION_STATUSES.ACTIVE,
    "2026-08-18T10:05:00.000Z",
  );
  assert.equal(active.verifiedAt, "2026-08-18T10:05:00.000Z");

  const paused = transitionSourceConnection(active, SOURCE_CONNECTION_STATUSES.PAUSED, "2026-08-18T10:06:00.000Z");
  const resumed = transitionSourceConnection(paused, SOURCE_CONNECTION_STATUSES.ACTIVE, "2026-08-18T10:07:00.000Z");
  assert.equal(resumed.verifiedAt, active.verifiedAt);
});

test("lastEventAt is monotonic when webhook deliveries arrive out of order", () => {
  const active = transitionSourceConnection(
    pendingConnection(),
    SOURCE_CONNECTION_STATUSES.ACTIVE,
    "2026-08-18T10:05:00.000Z",
  );
  const newer = updateSourceConnection(active, { lastEventAt: "2026-08-18T12:00:00.000Z" }, "2026-08-18T12:00:01.000Z");
  const delayedOlder = updateSourceConnection(newer, { lastEventAt: "2026-08-18T11:00:00.000Z" }, "2026-08-18T12:00:02.000Z");

  assert.equal(delayedOlder.lastEventAt, "2026-08-18T12:00:00.000Z");
  assert.equal(delayedOlder.updatedAt, "2026-08-18T12:00:02.000Z");
});
