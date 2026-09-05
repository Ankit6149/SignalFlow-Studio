import { createPostgresSourceConnectionRepository } from "../infrastructure/postgresConnectedSourceAdapters.mjs";
import { createPostgresCredentialVault } from "../infrastructure/postgresCredentialVaultAdapter.mjs";
import { createGithubAppApiClient, readGithubAppConfiguration } from "../integrations/github/githubAppApi.mjs";
import { createGithubRepositoryApiClient } from "../integrations/github/githubRepositoryApi.mjs";
import { normalizeSourceConnection, SOURCE_CONNECTION_STATUSES } from "../domain/sourceConnections.mjs";
import { resolveCredentialVaultSecret } from "./runtimeSigningSecrets.mjs";
import { resolveGithubRuntimeEnv } from "./githubRuntimeConfig.mjs";

const SECRET_KIND = "github_app_credentials";

function text(value) {
  return String(value || "").trim();
}

function required(value, field, maxLength = 100000) {
  const normalized = text(value);
  if (!normalized) throw new TypeError(`${field} is required.`);
  if (normalized.length > maxLength) throw new TypeError(`${field} is too long.`);
  return normalized;
}

function normalizeStoredCredentials(value, origin) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    const error = new Error("Stored GitHub App credentials are invalid.");
    error.code = "github_credential_record_invalid";
    throw error;
  }
  const appId = required(value.appId, "GitHub App ID", 80);
  if (!/^\d+$/.test(appId)) throw new TypeError("Stored GitHub App ID must be numeric.");
  const slug = required(value.slug, "GitHub App slug", 160).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new TypeError("Stored GitHub App slug is invalid.");
  const privateKey = required(value.privateKey, "GitHub App private key");
  if (!privateKey.includes("BEGIN") || !privateKey.includes("PRIVATE KEY")) {
    throw new TypeError("Stored GitHub App private key is not PEM.");
  }
  const base = new URL(required(origin, "SignalFlow origin", 1000));
  base.pathname = "/";
  base.search = "";
  base.hash = "";
  const canonicalOrigin = base.toString().replace(/\/$/, "");
  return Object.freeze({
    appId,
    slug,
    privateKey,
    clientId: required(value.clientId, "GitHub App client ID", 300),
    clientSecret: required(value.clientSecret, "GitHub App client secret", 2000),
    webhookSecret: required(value.webhookSecret, "GitHub App webhook secret", 2000),
    callbackUrl: `${canonicalOrigin}/api/sources/github/oauth/callback`,
  });
}

export function githubManifestPrerequisiteStatus(env = process.env) {
  const runtimeEnv = resolveGithubRuntimeEnv(env);
  const missing = [];
  if (!text(runtimeEnv.DATABASE_URL)) missing.push("DATABASE_URL");
  if (!text(runtimeEnv.NEXTAUTH_URL)) missing.push("NEXTAUTH_URL");
  if (!text(runtimeEnv.GITHUB_INSTALL_STATE_SECRET)) missing.push("GITHUB_INSTALL_STATE_SECRET|SIGNALFLOW_ACCESS_KEY");
  if (resolveCredentialVaultSecret(runtimeEnv).length < 32) {
    missing.push("SIGNALFLOW_CREDENTIAL_VAULT_SECRET|SIGNALFLOW_ACCESS_KEY");
  }
  return Object.freeze({ configured: missing.length === 0, missing: [...new Set(missing)].sort() });
}

export function hasLegacyGithubAppConfiguration(env = process.env) {
  const runtimeEnv = resolveGithubRuntimeEnv(env);
  return [
    "GITHUB_APP_ID",
    "GITHUB_APP_SLUG",
    "GITHUB_APP_PRIVATE_KEY",
    "GITHUB_APP_CLIENT_ID",
    "GITHUB_APP_CLIENT_SECRET",
  ].every((name) => text(runtimeEnv[name]));
}

export function createGithubCredentialAuthority({
  database,
  env = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!database || typeof database.query !== "function") throw new TypeError("GitHub credential authority requires a database executor.");
  const runtimeEnv = resolveGithubRuntimeEnv(env);
  const origin = required(runtimeEnv.NEXTAUTH_URL, "SignalFlow origin", 1000);
  const vaultSecret = resolveCredentialVaultSecret(runtimeEnv);
  const trustedConnections = createPostgresSourceConnectionRepository({ database, trustedServerLookup: true });

  function vaultForWorkspace(workspaceId) {
    return createPostgresCredentialVault({
      database,
      workspaceId,
      vaultSecret,
    });
  }

  async function resolveAppConfiguration(connectionInput) {
    const connection = normalizeSourceConnection(connectionInput);
    if (connection.provider !== "github") {
      const error = new Error("GitHub authority cannot resolve a non-GitHub SourceConnection.");
      error.code = "github_connection_not_found";
      throw error;
    }
    if (connection.credentialRef) {
      const stored = await vaultForWorkspace(connection.workspaceId).get(connection.credentialRef, SECRET_KIND);
      if (!stored) {
        const error = new Error("GitHub credential reference could not be resolved.");
        error.code = "github_credential_record_missing";
        throw error;
      }
      return normalizeStoredCredentials(stored, origin);
    }
    if (!hasLegacyGithubAppConfiguration(runtimeEnv)) {
      const error = new Error("GitHub App authority has not been provisioned for this connection.");
      error.code = "github_app_unconfigured";
      throw error;
    }
    const legacy = readGithubAppConfiguration(runtimeEnv);
    return Object.freeze({ ...legacy, webhookSecret: text(runtimeEnv.GITHUB_WEBHOOK_SECRET) || null });
  }

  async function resolveAppClient(connection) {
    const config = await resolveAppConfiguration(connection);
    return createGithubAppApiClient({
      appId: config.appId,
      privateKey: config.privateKey,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      callbackUrl: config.callbackUrl,
      fetchImpl,
    });
  }

  async function resolveRepositoryApi(connection) {
    const config = await resolveAppConfiguration(connection);
    return createGithubRepositoryApiClient({
      appId: config.appId,
      privateKey: config.privateKey,
      fetchImpl,
    });
  }

  async function resolveWebhookSecretForInstallation(installationId) {
    const id = required(installationId, "GitHub installation ID", 80);
    if (!/^\d+$/.test(id)) return "";
    const matches = (await trustedConnections.findByProviderInstallation("github", id))
      .map(normalizeSourceConnection)
      .filter((connection) => connection.provider === "github" && connection.status !== SOURCE_CONNECTION_STATUSES.REVOKED);
    if (matches.length > 1) {
      const error = new Error("GitHub installation resolves to multiple SignalFlow authorities.");
      error.code = "github_source_ambiguous";
      throw error;
    }
    if (matches.length === 1) {
      const config = await resolveAppConfiguration(matches[0]);
      return text(config.webhookSecret);
    }
    return text(runtimeEnv.GITHUB_WEBHOOK_SECRET);
  }

  return Object.freeze({
    resolveAppConfiguration,
    resolveAppClient,
    resolveRepositoryApi,
    resolveWebhookSecretForInstallation,
  });
}
