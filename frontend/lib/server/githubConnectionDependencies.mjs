import { createGithubSourceConnectionApplication } from "../application/githubSourceConnectionApplication.mjs";
import { createSystemClock, createSystemIdService } from "../domain/ports.mjs";
import { createPostgresSourceConnectionRepository } from "../infrastructure/postgresConnectedSourceAdapters.mjs";
import {
  buildGithubAppInstallationUrl,
  createGithubAppApiClient,
  githubAppConfigurationStatus,
  readGithubAppConfiguration,
} from "../integrations/github/githubAppApi.mjs";
import {
  createGithubAuthorizationState,
  createGithubInstallState,
  verifyGithubAuthorizationState,
  verifyGithubInstallState,
} from "./githubInstallState.mjs";
import { createNeonQueryExecutor } from "./neonDatabase.mjs";

function opaque(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new TypeError(`${field} is required.`);
  if (/[/\\]|^[a-zA-Z]:/.test(normalized)) throw new TypeError(`${field} must be an opaque identifier.`);
  return normalized;
}

function enabledFlag(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

export function resolveOwnerWorkspaceId(env = process.env) {
  return opaque(env.SIGNALFLOW_WORKSPACE_ID || "owner-local", "SIGNALFLOW_WORKSPACE_ID");
}

export function githubSourceConnectionConfigurationStatus(env = process.env) {
  const github = githubAppConfigurationStatus(env);
  const missing = [...github.missing];
  if (enabledFlag(env.SIGNALFLOW_PUBLIC_HOSTED) && !String(env.SIGNALFLOW_ACCESS_KEY || "").trim()) {
    missing.push("SIGNALFLOW_ACCESS_KEY");
  }
  return Object.freeze({
    configured: missing.length === 0,
    missing: [...new Set(missing)],
    workspaceIdConfigured: Boolean(String(env.SIGNALFLOW_WORKSPACE_ID || "").trim()),
  });
}

export function createProductionGithubSourceConnectionApplication({
  env = process.env,
  fetchImpl = globalThis.fetch,
  clock = createSystemClock(),
  idService = createSystemIdService("signalflow"),
} = {}) {
  const config = readGithubAppConfiguration(env);
  const workspaceId = resolveOwnerWorkspaceId(env);
  const database = createNeonQueryExecutor({ databaseUrl: env.DATABASE_URL });
  const sourceConnectionRepository = createPostgresSourceConnectionRepository({ database, workspaceId });
  const githubAppClient = createGithubAppApiClient({
    appId: config.appId,
    privateKey: config.privateKey,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    callbackUrl: config.callbackUrl,
    fetchImpl,
  });
  const stateSecret = String(env.GITHUB_INSTALL_STATE_SECRET || "").trim();
  const stateNow = () => Date.parse(clock.now());
  const installStateCodec = Object.freeze({
    createInstall(input) {
      return createGithubInstallState({ ...input, secret: stateSecret, now: stateNow() });
    },
    verifyInstall(state, options) {
      return verifyGithubInstallState({ state, ...options, secret: stateSecret, now: stateNow() });
    },
    createAuthorization(input) {
      return createGithubAuthorizationState({ ...input, secret: stateSecret, now: stateNow() });
    },
    verifyAuthorization(state, options) {
      return verifyGithubAuthorizationState({ state, ...options, secret: stateSecret, now: stateNow() });
    },
  });

  return createGithubSourceConnectionApplication({
    workspaceId,
    sourceConnectionRepository,
    githubAppClient,
    installStateCodec,
    installationUrlBuilder: (state) => buildGithubAppInstallationUrl({ slug: config.slug, state }),
    clock,
    idService,
  });
}
