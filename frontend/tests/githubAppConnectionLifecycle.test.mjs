import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";

import { createGithubSourceConnectionApplication, DEFAULT_GITHUB_EVENT_FAMILIES } from "../lib/application/githubSourceConnectionApplication.mjs";
import { createMemorySourceConnectionRepository } from "../lib/infrastructure/sourceConnectionAdapters.mjs";
import { createGithubAppApiClient, createGithubAppJwt } from "../lib/integrations/github/githubAppApi.mjs";
import {
  createGithubAuthorizationState,
  createGithubInstallState,
  verifyGithubAuthorizationState,
  verifyGithubInstallState,
} from "../lib/server/githubInstallState.mjs";
import { createGithubConnectionHandlers } from "../lib/server/githubConnectionRoutes.mjs";

const NOW = "2026-08-20T17:30:00.000Z";
const STATE_SECRET = "signalflow-test-install-state-secret-123456";

function clock() {
  return { now: () => NOW };
}

function ids() {
  let sequence = 0;
  return { create: (kind) => `test-${kind}-${++sequence}` };
}

function stateCodec() {
  return {
    createInstall(input) {
      return createGithubInstallState({ ...input, secret: STATE_SECRET, now: Date.parse(NOW), nonce: "install-nonce" });
    },
    verifyInstall(state, options) {
      return verifyGithubInstallState({ state, ...options, secret: STATE_SECRET, now: Date.parse(NOW) });
    },
    createAuthorization(input) {
      return createGithubAuthorizationState({ ...input, secret: STATE_SECRET, now: Date.parse(NOW), nonce: "auth-nonce" });
    },
    verifyAuthorization(state, options) {
      return verifyGithubAuthorizationState({ state, ...options, secret: STATE_SECRET, now: Date.parse(NOW) });
    },
  };
}

function installationUrlBuilder(state) {
  const url = new URL("https://github.com/apps/signalflow-test/installations/new");
  url.searchParams.set("state", state);
  return url.toString();
}

function githubClient({ authorizationFailure = null, permissionScopes = ["contents:read", "metadata:read", "pull_requests:read"] } = {}) {
  const calls = [];
  return {
    calls,
    buildUserAuthorizationUrl(state) {
      calls.push(["buildUserAuthorizationUrl"]);
      const url = new URL("https://github.com/login/oauth/authorize");
      url.searchParams.set("state", state);
      return url.toString();
    },
    async exchangeUserCode(code) {
      calls.push(["exchangeUserCode", code]);
      return "ephemeral-user-token";
    },
    async verifyUserInstallationAccess(token, installationId) {
      calls.push(["verifyUserInstallationAccess", token, installationId]);
      if (authorizationFailure) throw authorizationFailure;
      return { totalCount: 1 };
    },
    async getInstallation(installationId) {
      calls.push(["getInstallation", installationId]);
      return {
        installationId: String(installationId),
        accountRef: "42",
        accountLogin: "owner",
        accountType: "user",
        repositorySelection: "selected",
        permissionScopes,
      };
    },
    async listInstallationRepositories(installationId) {
      calls.push(["listRepositories", installationId]);
      return [{
        id: "9001",
        fullName: "owner/product",
        name: "product",
        ownerLogin: "owner",
        private: true,
        visibility: "private",
        defaultBranch: "master",
        archived: false,
        disabled: false,
      }];
    },
    async getRepositoryForInstallation(installationId, repositoryId) {
      calls.push(["getRepository", installationId, repositoryId]);
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

function createApplication({ repository = createMemorySourceConnectionRepository(), github = githubClient() } = {}) {
  return {
    repository,
    github,
    app: createGithubSourceConnectionApplication({
      workspaceId: "owner-local",
      sourceConnectionRepository: repository,
      githubAppClient: github,
      installStateCodec: stateCodec(),
      installationUrlBuilder,
      clock: clock(),
      idService: ids(),
    }),
  };
}

test("install and authorization states are purpose-bound, workspace-bound, time-bounded and tamper-evident", () => {
  const installState = createGithubInstallState({
    secret: STATE_SECRET,
    workspaceId: "owner-local",
    sourceConnectionId: "connection-1",
    returnTo: "/?workspace=connections",
    now: Date.parse(NOW),
    nonce: "install-nonce",
  });
  const install = verifyGithubInstallState({
    state: installState,
    secret: STATE_SECRET,
    workspaceId: "owner-local",
    now: Date.parse(NOW) + 30_000,
  });
  assert.equal(install.sourceConnectionId, "connection-1");
  assert.equal(install.installationId, null);

  const authState = createGithubAuthorizationState({
    secret: STATE_SECRET,
    workspaceId: "owner-local",
    sourceConnectionId: "connection-1",
    installationId: "77",
    returnTo: "/?workspace=connections",
    now: Date.parse(NOW),
    nonce: "auth-nonce",
  });
  const authorization = verifyGithubAuthorizationState({
    state: authState,
    secret: STATE_SECRET,
    workspaceId: "owner-local",
    now: Date.parse(NOW) + 30_000,
  });
  assert.equal(authorization.installationId, "77");
  assert.throws(
    () => verifyGithubInstallState({ state: authState, secret: STATE_SECRET, workspaceId: "owner-local", now: Date.parse(NOW) }),
    (error) => error?.code === "github_install_state_invalid",
    "authorization state cannot be replayed as setup state",
  );
  assert.throws(
    () => verifyGithubAuthorizationState({ state: installState, secret: STATE_SECRET, workspaceId: "owner-local", now: Date.parse(NOW) }),
    (error) => error?.code === "github_install_state_invalid",
    "setup state cannot be replayed as authorization state",
  );
  assert.throws(
    () => verifyGithubInstallState({ state: `${installState.slice(0, -1)}x`, secret: STATE_SECRET, workspaceId: "owner-local", now: Date.parse(NOW) }),
    (error) => error?.code === "github_install_state_invalid",
  );
  assert.throws(
    () => verifyGithubInstallState({ state: installState, secret: STATE_SECRET, workspaceId: "other-workspace", now: Date.parse(NOW) }),
    (error) => error?.code === "github_install_state_workspace_mismatch",
  );
  assert.throws(
    () => verifyGithubInstallState({ state: installState, secret: STATE_SECRET, workspaceId: "owner-local", now: Date.parse(NOW) + 11 * 60_000 }),
    (error) => error?.code === "github_install_state_expired",
  );
  assert.throws(
    () => createGithubInstallState({ secret: STATE_SECRET, workspaceId: "owner-local", sourceConnectionId: "connection-1", returnTo: "https://evil.invalid/callback", now: Date.parse(NOW) }),
    /same-origin path/,
  );
});

test("GitHub App adapter uses app JWT, ephemeral user authorization and ephemeral installation tokens", async () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" });
  const jwt = createGithubAppJwt({ appId: "12345", privateKey: pem, now: Date.parse(NOW) });
  assert.equal(jwt.split(".").length, 3);

  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url: String(url), options });
    const parsed = new URL(url);
    const path = parsed.pathname;
    if (path === "/login/oauth/access_token") {
      assert.match(String(options.body), /client_id=client-id/);
      assert.match(String(options.body), /code=oauth-code/);
      return Response.json({ access_token: "ephemeral-user-token" });
    }
    if (path === "/user/installations/77/repositories") {
      assert.equal(options.headers.Authorization, "Bearer ephemeral-user-token");
      return Response.json({ total_count: 1, repositories: [] });
    }
    if (path === "/app/installations/77") {
      return Response.json({
        id: 77,
        account: { id: 42, login: "owner", type: "User" },
        repository_selection: "selected",
        permissions: { contents: "read", metadata: "read", pull_requests: "read" },
      });
    }
    if (path === "/app/installations/77/access_tokens") {
      return Response.json({ token: "temporary-installation-token", expires_at: "2026-08-20T18:30:00Z" });
    }
    if (path === "/repositories/9001") {
      assert.equal(options.headers.Authorization, "Bearer temporary-installation-token");
      return Response.json({
        id: 9001,
        full_name: "owner/product",
        name: "product",
        owner: { login: "owner" },
        private: true,
        visibility: "private",
        default_branch: "master",
      });
    }
    throw new Error(`Unexpected test request: ${path}`);
  };
  const client = createGithubAppApiClient({
    appId: "12345",
    privateKey: pem,
    clientId: "client-id",
    clientSecret: "client-secret",
    callbackUrl: "https://signalflow.invalid/api/sources/github/oauth/callback",
    fetchImpl,
    now: () => Date.parse(NOW),
  });
  const userToken = await client.exchangeUserCode("oauth-code");
  await client.verifyUserInstallationAccess(userToken, "77");
  const installation = await client.getInstallation("77");
  const repository = await client.getRepositoryForInstallation("77", "9001");
  assert.equal(repository.id, "9001");
  assert.doesNotMatch(JSON.stringify({ installation, repository }), /ephemeral-user-token|temporary-installation-token|client-secret/);
  const appRequest = requests.find((item) => new URL(item.url).pathname === "/app/installations/77");
  assert.match(appRequest.options.headers.Authorization, /^Bearer [^.]+\.[^.]+\.[^.]+$/);
});

test("setup installation_id is not persisted until exact installation is verified for the authorized user", async () => {
  const { repository, github, app } = createApplication();
  const started = await app.startInstallation();
  const installState = new URL(started.installUrl).searchParams.get("state");

  const setup = await app.beginAuthorization({ state: installState, installationId: "77" });
  const beforeAuthorization = await repository.get(started.sourceConnectionId);
  assert.equal(beforeAuthorization.installationRef, null);
  assert.equal(beforeAuthorization.verifiedAt, null);
  assert.equal(beforeAuthorization.status, "pending");

  const authorizationState = new URL(setup.authorizationUrl).searchParams.get("state");
  const completed = await app.completeAuthorization({ state: authorizationState, code: "oauth-code" });
  assert.equal(completed.connection.installationRef, "77");
  assert.equal(completed.connection.verifiedAt, NOW);
  assert.equal(completed.connection.status, "pending");
  assert.equal(completed.connection.credentialRef, null);
  assert.deepEqual(
    github.calls.slice(1, 4).map((item) => item[0]),
    ["exchangeUserCode", "verifyUserInstallationAccess", "getInstallation"],
    "user authorization verifies the exact installation before app installation metadata is persisted",
  );
});

test("spoofed or unauthorized setup installation fails closed without mutating SourceConnection authority", async () => {
  const unauthorized = new Error("not authorized");
  unauthorized.code = "github_user_authorization_failed";
  const repository = createMemorySourceConnectionRepository();
  const github = githubClient({ authorizationFailure: unauthorized });
  const { app } = createApplication({ repository, github });
  const started = await app.startInstallation();
  const installState = new URL(started.installUrl).searchParams.get("state");
  const setup = await app.beginAuthorization({ state: installState, installationId: "999" });
  const authorizationState = new URL(setup.authorizationUrl).searchParams.get("state");

  await assert.rejects(
    () => app.completeAuthorization({ state: authorizationState, code: "oauth-code" }),
    (error) => error?.code === "github_user_authorization_failed",
  );
  const stored = await repository.get(started.sourceConnectionId);
  assert.equal(stored.installationRef, null);
  assert.equal(stored.providerAccountRef, null);
  assert.equal(stored.verifiedAt, null);
});

test("verified installation requires minimum repository read permissions", async () => {
  const { app } = createApplication({ github: githubClient({ permissionScopes: ["metadata:read", "pull_requests:read"] }) });
  const started = await app.startInstallation();
  const installState = new URL(started.installUrl).searchParams.get("state");
  const setup = await app.beginAuthorization({ state: installState, installationId: "77" });
  const authorizationState = new URL(setup.authorizationUrl).searchParams.get("state");
  await assert.rejects(
    () => app.completeAuthorization({ state: authorizationState, code: "oauth-code" }),
    (error) => error?.code === "github_installation_permissions_insufficient" && error.missing.includes("contents:read"),
  );
});

test("owner GitHub connection moves verified pending → active with safe defaults and stable project identity", async () => {
  const { github, app } = createApplication();
  const started = await app.startInstallation();
  const installState = new URL(started.installUrl).searchParams.get("state");
  const setup = await app.beginAuthorization({ state: installState, installationId: "77" });
  const authorizationState = new URL(setup.authorizationUrl).searchParams.get("state");
  await app.completeAuthorization({ state: authorizationState, code: "oauth-code" });

  const discovered = await app.listRepositories(started.sourceConnectionId);
  assert.equal(discovered.length, 1);
  const selected = await app.selectRepository({ sourceConnectionId: started.sourceConnectionId, repositoryId: "9001" });
  assert.equal(selected.connection.status, "active");
  assert.equal(selected.projectId, "sf-project-github-9001");
  assert.deepEqual(selected.connection.resourceScopes[0].eventFamilies, [...DEFAULT_GITHUB_EVENT_FAMILIES]);
  assert.equal(selected.connection.resourceScopes[0].enabled, true);
  assert.ok(selected.connection.capabilities.includes("repository_contents"));

  const selectedAgain = await app.selectRepository({ sourceConnectionId: started.sourceConnectionId, repositoryId: "9001" });
  assert.equal(selectedAgain.projectId, selected.projectId);
  assert.equal(selectedAgain.connection.resourceScopes.length, 1, "reselect does not duplicate repository scope");

  assert.equal((await app.pause(started.sourceConnectionId)).status, "paused");
  assert.equal((await app.resume(started.sourceConnectionId)).status, "active");
  const revoked = await app.revoke(started.sourceConnectionId);
  assert.equal(revoked.status, "revoked");
  assert.equal(revoked.resourceScopes[0].enabled, false);
  await assert.rejects(() => app.resume(started.sourceConnectionId), (error) => error?.code === "github_connection_revoked");
  assert.ok(github.calls.some((item) => item[0] === "getRepository"));
});

test("reinstall of the same GitHub installation reuses canonical SourceConnection and cannot create webhook ambiguity", async () => {
  const repository = createMemorySourceConnectionRepository();
  const github = githubClient();
  const first = createApplication({ repository, github }).app;
  const firstStarted = await first.startInstallation();
  const firstSetup = await first.beginAuthorization({
    state: new URL(firstStarted.installUrl).searchParams.get("state"),
    installationId: "77",
  });
  await first.completeAuthorization({
    state: new URL(firstSetup.authorizationUrl).searchParams.get("state"),
    code: "first-code",
  });
  await first.selectRepository({ sourceConnectionId: firstStarted.sourceConnectionId, repositoryId: "9001" });

  const second = createApplication({ repository, github }).app;
  const secondStarted = await second.startInstallation();
  const secondSetup = await second.beginAuthorization({
    state: new URL(secondStarted.installUrl).searchParams.get("state"),
    installationId: "77",
  });
  const completed = await second.completeAuthorization({
    state: new URL(secondSetup.authorizationUrl).searchParams.get("state"),
    code: "second-code",
  });
  assert.equal(completed.connection.sourceConnectionId, firstStarted.sourceConnectionId);
  const installationMatches = (await repository.list()).filter((item) => item.installationRef === "77");
  assert.equal(installationMatches.length, 1);
  assert.equal(installationMatches[0].status, "active");
});

test("repository selection is verified through installation authority and refuses archived repositories", async () => {
  const github = githubClient();
  github.getRepositoryForInstallation = async () => ({
    id: "9001",
    fullName: "owner/archived",
    name: "archived",
    ownerLogin: "owner",
    private: false,
    visibility: "public",
    defaultBranch: "main",
    archived: true,
    disabled: false,
  });
  const { app } = createApplication({ github });
  const started = await app.startInstallation();
  const setup = await app.beginAuthorization({
    state: new URL(started.installUrl).searchParams.get("state"),
    installationId: "77",
  });
  await app.completeAuthorization({ state: new URL(setup.authorizationUrl).searchParams.get("state"), code: "oauth-code" });
  await assert.rejects(
    () => app.selectRepository({ sourceConnectionId: started.sourceConnectionId, repositoryId: "9001" }),
    (error) => error?.code === "github_repository_not_observable",
  );
});

test("HTTP setup callback redirects to user authorization, OAuth callback completes connection, and secrets never reach responses", async () => {
  let completionCalls = 0;
  const connection = {
    sourceConnectionId: "connection-1",
    provider: "github",
    providerAccountRef: "42",
    installationRef: "77",
    credentialRef: "must-never-reach-browser",
    status: "pending",
    permissionScopes: ["contents:read", "metadata:read", "pull_requests:read"],
    capabilities: ["repository_events"],
    resourceScopes: [],
    verifiedAt: NOW,
    lastEventAt: null,
    lastErrorCode: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
  const application = {
    listConnections: async () => [connection],
    beginAuthorization: async () => ({ authorizationUrl: "https://github.com/login/oauth/authorize?state=auth-state" }),
    completeAuthorization: async ({ state, code }) => {
      completionCalls += 1;
      assert.equal(state, "auth-state");
      assert.equal(code, "oauth-code");
      return { connection, returnTo: "/?workspace=connections" };
    },
  };
  const handlers = createGithubConnectionHandlers({
    requireOwnerAccess: (request) => request.headers.get("x-test-owner") === "yes" ? null : new Response("denied", { status: 401 }),
    configurationStatus: () => ({ configured: true, missing: [] }),
    createApplication: () => application,
  });

  const denied = await handlers.status(new Request("https://signalflow.invalid/api/sources/github/connect"));
  assert.equal(denied.status, 401);

  const status = await handlers.status(new Request("https://signalflow.invalid/api/sources/github/connect", { headers: { "x-test-owner": "yes" } }));
  const statusBody = await status.text();
  assert.doesNotMatch(statusBody, /credentialRef|must-never-reach-browser/);

  const setup = await handlers.callback(new Request("https://signalflow.invalid/api/sources/github/callback?state=install-state&installation_id=77", { headers: { "x-test-owner": "yes" } }));
  assert.equal(setup.status, 303);
  assert.match(setup.headers.get("location"), /^https:\/\/github\.com\/login\/oauth\/authorize/);
  assert.equal(completionCalls, 0, "setup callback cannot mark installation verified");

  const oauth = await handlers.oauthCallback(new Request("https://signalflow.invalid/api/sources/github/oauth/callback?state=auth-state&code=oauth-code", { headers: { "x-test-owner": "yes" } }));
  assert.equal(oauth.status, 303);
  assert.equal(completionCalls, 1);
  const redirect = new URL(oauth.headers.get("location"));
  assert.equal(redirect.searchParams.get("workspace"), "connections");
  assert.equal(redirect.searchParams.get("github_source_status"), "installed");
  assert.equal(redirect.searchParams.get("source_connection"), "connection-1");
});
