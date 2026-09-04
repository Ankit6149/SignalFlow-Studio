import { createGithubManifestProvisioningApplication } from "../application/githubManifestProvisioningApplication.mjs";
import { createGithubRepositoryBootstrapApplication } from "../application/githubRepositoryBootstrapApplication.mjs";
import { createGithubRepositoryFirstOpportunityApplication } from "../application/githubRepositoryFirstOpportunityApplication.mjs";
import { createGithubSourceConnectionApplication } from "../application/githubSourceConnectionApplication.mjs";
import { createProjectContextApplication } from "../application/projectContextApplication.mjs";
import { createSystemClock, createSystemIdService } from "../domain/ports.mjs";
import { createPostgresSourceConnectionRepository } from "../infrastructure/postgresConnectedSourceAdapters.mjs";
import { createPostgresCredentialVault } from "../infrastructure/postgresCredentialVaultAdapter.mjs";
import { createPostgresProjectContextRepository } from "../infrastructure/postgresProjectContextAdapter.mjs";
import { createPostgresSourceArtifactRepository } from "../infrastructure/postgresSourceArtifactAdapter.mjs";
import { createServerProjectContextInferenceAdapter } from "../infrastructure/serverInferenceAdapter.mjs";
import {
  buildGithubAppInstallationUrl,
  githubAppConfigurationStatus,
  readGithubAppConfiguration,
} from "../integrations/github/githubAppApi.mjs";
import {
  createGithubAuthorizationState,
  createGithubInstallState,
  verifyGithubAuthorizationState,
  verifyGithubInstallState,
} from "./githubInstallState.mjs";
import {
  createGithubCredentialAuthority,
  githubManifestPrerequisiteStatus,
  hasLegacyGithubAppConfiguration,
} from "./githubCredentialAuthority.mjs";
import { resolveGithubRuntimeEnv } from "./githubRuntimeConfig.mjs";
import { createHostedOpportunityCore } from "./hostedOpportunityCore.mjs";
import { createNeonQueryExecutor } from "./neonDatabase.mjs";
import { ownerAccessConfigurationStatus } from "./ownerAccessPolicy.mjs";
import { resolveCredentialVaultSecret } from "./runtimeSigningSecrets.mjs";

function opaque(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new TypeError(`${field} is required.`);
  if (/[/\\]|^[a-zA-Z]:/.test(normalized)) throw new TypeError(`${field} must be an opaque identifier.`);
  return normalized;
}

export function resolveOwnerWorkspaceId(env = process.env) {
  return opaque(env.SIGNALFLOW_WORKSPACE_ID || "owner-local", "SIGNALFLOW_WORKSPACE_ID");
}

function legacyConfigurationStatus(runtimeEnv) {
  return githubAppConfigurationStatus(runtimeEnv);
}

export function githubSourceConnectionConfigurationStatus(env = process.env) {
  const runtimeEnv = resolveGithubRuntimeEnv(env);
  const legacy = legacyConfigurationStatus(runtimeEnv);
  const manifest = githubManifestPrerequisiteStatus(runtimeEnv);
  const ownerAccess = ownerAccessConfigurationStatus(env);
  const ownerReady = !ownerAccess.publicHosted || ownerAccess.configured;
  const authorityReady = legacy.configured || manifest.configured;
  const missing = authorityReady ? [] : [...manifest.missing];
  if (!ownerReady) missing.push("SIGNALFLOW_ACCESS_KEY");
  return Object.freeze({
    configured: authorityReady && ownerReady,
    missing: [...new Set(missing)].sort(),
    mode: legacy.configured ? "legacy_app" : manifest.configured ? "manifest" : "unconfigured",
    workspaceIdConfigured: Boolean(String(env.SIGNALFLOW_WORKSPACE_ID || "").trim()),
  });
}

function createInstallStateCodec({ runtimeEnv, clock }) {
  const stateSecret = runtimeEnv.GITHUB_INSTALL_STATE_SECRET;
  const stateNow = () => Date.parse(clock.now());
  return Object.freeze({
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
}

export function createProductionGithubSourceConnectionApplication({
  env = process.env,
  fetchImpl = globalThis.fetch,
  clock = createSystemClock(),
  idService = createSystemIdService("signalflow"),
} = {}) {
  const runtimeEnv = resolveGithubRuntimeEnv(env);
  const workspaceId = resolveOwnerWorkspaceId(runtimeEnv);
  const database = createNeonQueryExecutor({ databaseUrl: runtimeEnv.DATABASE_URL });
  const sourceConnectionRepository = createPostgresSourceConnectionRepository({ database, workspaceId });
  const installStateCodec = createInstallStateCodec({ runtimeEnv, clock });
  const authority = createGithubCredentialAuthority({ database, env: runtimeEnv, fetchImpl });
  const legacyConfigured = hasLegacyGithubAppConfiguration(runtimeEnv);
  const legacyConfig = legacyConfigured ? readGithubAppConfiguration(runtimeEnv) : null;

  const application = createGithubSourceConnectionApplication({
    workspaceId,
    sourceConnectionRepository,
    resolveGithubAppClient: authority.resolveAppClient,
    installStateCodec,
    installationUrlBuilder: legacyConfig
      ? (state) => buildGithubAppInstallationUrl({ slug: legacyConfig.slug, state })
      : null,
    clock,
    idService,
  });

  const credentialVault = createPostgresCredentialVault({
    database,
    workspaceId,
    vaultSecret: resolveCredentialVaultSecret(runtimeEnv),
    clock,
  });
  const manifest = createGithubManifestProvisioningApplication({
    workspaceId,
    sourceConnectionRepository,
    credentialVault,
    installStateCodec,
    origin: runtimeEnv.NEXTAUTH_URL,
    fetchImpl,
    clock,
    idService,
  });

  return Object.freeze({
    ...application,
    async startInstallation(input) {
      if (legacyConfig) return application.startInstallation(input);
      return manifest.startRegistration(input);
    },
    prepareManifestRegistration: manifest.prepareRegistration,
    completeManifestRegistration: manifest.completeRegistration,
  });
}

export function createProductionGithubWebhookSecretResolver({
  env = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  const runtimeEnv = resolveGithubRuntimeEnv(env);
  if (!String(runtimeEnv.DATABASE_URL || "").trim()) return null;
  const database = createNeonQueryExecutor({ databaseUrl: runtimeEnv.DATABASE_URL });
  const authority = createGithubCredentialAuthority({ database, env: runtimeEnv, fetchImpl });
  return async function resolveWebhookSecret({ payload } = {}) {
    const installationId = String(payload?.installation?.id || "").trim();
    if (!installationId) return String(runtimeEnv.GITHUB_WEBHOOK_SECRET || "").trim();
    return authority.resolveWebhookSecretForInstallation(installationId);
  };
}

export function createProductionGithubRepositoryBootstrapApplication({
  origin,
  env = process.env,
  fetchImpl = globalThis.fetch,
  clock = createSystemClock(),
  idService = createSystemIdService("signalflow"),
} = {}) {
  const runtimeEnv = resolveGithubRuntimeEnv(env);
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
  const authority = createGithubCredentialAuthority({ database, env: runtimeEnv, fetchImpl });
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
    resolveGithubRepositoryApi: authority.resolveRepositoryApi,
    firstOpportunityApplication,
    clock,
  });
}
