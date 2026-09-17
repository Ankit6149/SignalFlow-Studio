import test from "node:test";
import assert from "node:assert/strict";

import { createGithubSourceConnectionApplication } from "../lib/application/githubSourceConnectionApplication.mjs";
import { createMemorySourceConnectionRepository } from "../lib/infrastructure/sourceConnectionAdapters.mjs";
import {
  createGithubAuthorizationState,
  createGithubInstallState,
  verifyGithubAuthorizationState,
  verifyGithubInstallState,
} from "../lib/server/githubInstallState.mjs";

const NOW = "2026-09-18T00:00:00.000Z";
const SECRET = "gp2-reconnect-test-secret-123456789";

function stateCodec() {
  return {
    createInstall(input) {
      return createGithubInstallState({ ...input, secret: SECRET, now: Date.parse(NOW), nonce: `install-${input.sourceConnectionId}` });
    },
    verifyInstall(state, options) {
      return verifyGithubInstallState({ state, ...options, secret: SECRET, now: Date.parse(NOW) });
    },
    createAuthorization(input) {
      return createGithubAuthorizationState({ ...input, secret: SECRET, now: Date.parse(NOW), nonce: `auth-${input.sourceConnectionId}` });
    },
    verifyAuthorization(state, options) {
      return verifyGithubAuthorizationState({ state, ...options, secret: SECRET, now: Date.parse(NOW) });
    },
  };
}

function githubClient() {
  return {
    buildUserAuthorizationUrl(state) {
      const url = new URL("https://github.com/login/oauth/authorize");
      url.searchParams.set("state", state);
      return url.toString();
    },
    async exchangeUserCode() { return "ephemeral-user-token"; },
    async verifyUserInstallationAccess() { return { totalCount: 1 }; },
    async getInstallation(installationId) {
      return {
        installationId: String(installationId),
        accountRef: "42",
        accountLogin: "owner",
        accountType: "user",
        repositorySelection: "selected",
        permissionScopes: ["contents:read", "metadata:read", "pull_requests:read"],
      };
    },
    async listInstallationRepositories() { return []; },
    async getRepositoryForInstallation(_installationId, repositoryId) {
      return {
        id: String(repositoryId),
        fullName: "owner/product",
        name: "product",
        ownerLogin: "owner",
        private: true,
        visibility: "private",
        defaultBranch: "master",
        archived: false,
        disabled: false,
      };
    },
  };
}

function installationUrlBuilder(state) {
  const url = new URL("https://github.com/apps/signalflow-test/installations/new");
  url.searchParams.set("state", state);
  return url.toString();
}

function createApplication(repository) {
  let sequence = 0;
  return createGithubSourceConnectionApplication({
    workspaceId: "owner-local",
    sourceConnectionRepository: repository,
    githubAppClient: githubClient(),
    installStateCodec: stateCodec(),
    installationUrlBuilder,
    clock: { now: () => NOW },
    idService: { create: (kind) => `reconnect-${kind}-${++sequence}` },
  });
}

async function authorize(app, started, code) {
  const setup = await app.beginAuthorization({
    state: new URL(started.installUrl).searchParams.get("state"),
    installationId: "77",
  });
  return app.completeAuthorization({
    state: new URL(setup.authorizationUrl).searchParams.get("state"),
    code,
  });
}

test("reinstall after revoke reuses canonical authority but does not silently reactivate old repository scope", async () => {
  const repository = createMemorySourceConnectionRepository();
  const first = createApplication(repository);
  const firstStarted = await first.startInstallation();
  await authorize(first, firstStarted, "first-code");
  const selected = await first.selectRepository({
    sourceConnectionId: firstStarted.sourceConnectionId,
    repositoryId: "9001",
  });
  assert.equal(selected.connection.status, "active");
  assert.equal(selected.connection.resourceScopes[0].enabled, true);

  const revoked = await first.revoke(firstStarted.sourceConnectionId);
  assert.equal(revoked.status, "revoked");
  assert.equal(revoked.resourceScopes[0].enabled, false);

  const second = createApplication(repository);
  const secondStarted = await second.startInstallation();
  assert.notEqual(secondStarted.sourceConnectionId, firstStarted.sourceConnectionId, "reinstall starts with fresh pending setup state");

  const reauthorized = await authorize(second, secondStarted, "second-code");
  assert.equal(reauthorized.connection.sourceConnectionId, firstStarted.sourceConnectionId, "verified same installation converges on the canonical authority record");
  assert.equal(reauthorized.connection.status, "pending", "reauthorization alone must not restore observation");
  assert.equal(reauthorized.connection.resourceScopes.length, 1);
  assert.equal(reauthorized.connection.resourceScopes[0].enabled, false, "revoked repository scope stays disabled until explicit reselection");

  const afterAuthorization = await repository.list();
  assert.equal(afterAuthorization.filter((item) => item.installationRef === "77").length, 1);
  assert.equal(afterAuthorization.some((item) => item.sourceConnectionId === secondStarted.sourceConnectionId), false, "temporary pending reconnect record is removed after canonical convergence");

  const reselected = await second.selectRepository({
    sourceConnectionId: reauthorized.connection.sourceConnectionId,
    repositoryId: "9001",
  });
  assert.equal(reselected.connection.status, "active");
  assert.equal(reselected.connection.resourceScopes.length, 1);
  assert.equal(reselected.connection.resourceScopes[0].enabled, true);
  assert.equal(reselected.projectId, "sf-project-github-9001");
});
