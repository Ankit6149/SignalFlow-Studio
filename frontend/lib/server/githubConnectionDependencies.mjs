import { createGithubRepositoryBootstrapApplication } from "../application/githubRepositoryBootstrapApplication.mjs";
import { createGithubRepositoryFirstOpportunityApplication } from "../application/githubRepositoryFirstOpportunityApplication.mjs";
import { createGithubSourceConnectionApplication } from "../application/githubSourceConnectionApplication.mjs";
import { createProjectContextApplication } from "../application/projectContextApplication.mjs";
import { createSystemClock, createSystemIdService } from "../domain/ports.mjs";
import { createPostgresSourceConnectionRepository } from "../infrastructure/postgresConnectedSourceAdapters.mjs";
import { createPostgresProjectContextRepository } from "../infrastructure/postgresProjectContextAdapter.mjs";
import { createPostgresSourceArtifactRepository } from "../infrastructure/postgresSourceArtifactAdapter.mjs";
import { createServerProjectContextInferenceAdapter } from "../infrastructure/serverInferenceAdapter.mjs";
import {
  buildGithubAppInstallationUrl,
  createGithubAppApiClient,
  githubAppConfigurationStatus,
  readGithubAppConfiguration,
} from "../integrations/github/githubAppApi.mjs";
import { createGithubRepositoryApiClient } from "../integrations/github/githubRepositoryApi.mjs";
import {
  createGithubAuthorizationState,
  createGithubInstallState,
  verifyGithubAuthorizationState,
  verifyGithubInstallState,
} from "./githubInstallState.mjs";
import { resolveGithubRuntimeEnv } from "./githubRuntimeConfig.mjs";
import { createHostedOpportunityCore } from "./hostedOpportunityCore.mjs";
import { createNeonQueryExecutor } from "./neonDatabase.mjs";
import { ownerAccessConfigurationStatus } from "./ownerAccessPolicy.mjs";

function opaque(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new TypeError(`${field} is required.`);
  if (/[/\\]|^[a-zA-Z]:/.test(normalized)) throw new TypeError(`${field} must be an opaque identifier.`);
  return normalized;
}

export function resolveOwnerWorkspaceId(env = process.env) {
  return opaque(env.SIGNALFLOW_WORKSPACE_ID || "owner-local", "SIGNALFLOW_WORKSPACE_ID");
}

export function githubSourceConnectionConfigurationStatus(env = process.env) {
  const runtimeEnv = resolveGithubRuntimeEnv(env);
  const github = githubAppConfigurationStatus(runtimeEnv);
  const ownerAccess = ownerAccessConfigurationStatus(env);
  const missing = [...github.missing];
  if (ownerAccess.publicHosted && !ownerAccess.configured) {
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
  const runtimeEnv = resolveGithubRuntimeEnv(env);
  const config = readGithubAppConfiguration(runtimeEnv);
  const workspaceId = resolveOwnerWorkspaceId(runtimeEnv);
  const database = createNeonQueryExecutor({ databaseUrl: runtimeEnv.DATABASE_URL });
  const sourceConnectionRepository = createPostgresSourceConnectionRepository({ database, workspaceId });
  const githubAppClient = createGithubAppApiClient({
    appId: config.appId,
    privateKey: config.privateKey,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    callbackUrl: config.callbackUrl,
    fetchImpl,
  });
  const stateSecret = runtimeEnv.GITHUB_INSTALL_STATE_SECRET;
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

export function createProductionGithubRepositoryBootstrapApplication({
  origin,
  env = process.env,
  fetchImpl = globalThis.fetch,
  clock = createSystemClock(),
  idService = createSystemIdService("signalflow"),
} = {}) {
  const runtimeEnv = resolveGithubRuntimeEnv(env);
  const config = readGithubAppConfiguration(runtimeEnv);
  const workspaceId = resolveOwnerWorkspaceId(runtimeEnv);
  const database = createNeonQueryExecutor({ databaseUrl: runtimeEnv.DATABASE_URL });
  const sourceConnectionRepository = createPostgresSourceConnectionRepository({ database, workspaceId });
  const sourceArtifactRepository = createPostgresSourceArtifactRepository({ database, workspaceId });
  const projectContextRepository = createPostgresProjectContextRepository({ database, workspaceId });
  const inferenceAdapter = createServerProjectContextInferenceAdapter({
    origin,
    accessKey: runtimeEnv.SIGNALFLOW_ACCESS_KEY,
    fetchImpl,
  });
  const projectContextApplication = createProjectContextApplication({
    workspaceId,
    repository: projectContextRepository,
    inferenceAdapter,
    clock,
    idService,
  });
  const githubRepositoryApi = createGithubRepositoryApiClient({
    appId: config.appId,
    privateKey: config.privateKey,
    fetchImpl,
  });
  const opportunityCore = createHostedOpportunityCore({
    workspaceId,
    origin,
    env: runtimeEnv,
    fetchImpl,
    clock,
    idService,
    database,
  });
  const firstOpportunityApplication = createGithubRepositoryFirstOpportunityApplication({
    workspaceId,
    contentSignalRepository: opportunityCore.contentSignalRepository,
    continuationApplication: opportunityCore.continuationApplication,
    clock,
    idService,
  });

  return createGithubRepositoryBootstrapApplication({
    workspaceId,
    sourceConnectionRepository,
    sourceArtifactRepository,
    projectContextApplication,
    githubRepositoryApi,
    firstOpportunityApplication,
    clock,
  });
}
