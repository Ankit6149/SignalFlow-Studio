import { createSign } from "node:crypto";

const API_VERSION = "2026-03-10";
const ACCEPT = "application/vnd.github+json";
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function required(value, field, maxLength = 20000) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new TypeError(`${field} is required.`);
  if (normalized.length > maxLength) throw new TypeError(`${field} is too long.`);
  return normalized;
}

function normalizePrivateKey(value) {
  const key = required(value, "GITHUB_APP_PRIVATE_KEY", 50000).replace(/\\n/g, "\n");
  if (!key.includes("BEGIN") || !key.includes("PRIVATE KEY")) {
    throw new TypeError("GITHUB_APP_PRIVATE_KEY is not a PEM private key.");
  }
  return key;
}

function integerId(value, field) {
  const normalized = required(value, field, 80);
  if (!/^\d+$/.test(normalized)) throw new TypeError(`${field} must be a numeric GitHub identifier.`);
  return normalized;
}

function base64Json(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function normalizeOrigin(value) {
  const url = new URL(required(value, "NEXTAUTH_URL", 1000));
  if (!new Set(["http:", "https:"]).has(url.protocol)) throw new TypeError("NEXTAUTH_URL must use http or https.");
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

export function createGithubAppJwt({ appId, privateKey, now = Date.now() } = {}) {
  const issuer = integerId(appId, "GitHub App ID");
  const key = normalizePrivateKey(privateKey);
  const nowSeconds = Math.floor(Number(now instanceof Date ? now.getTime() : now) / 1000);
  if (!Number.isFinite(nowSeconds)) throw new TypeError("GitHub App JWT clock is invalid.");
  const header = base64Json({ alg: "RS256", typ: "JWT" });
  const payload = base64Json({ iat: nowSeconds - 60, exp: nowSeconds + 9 * 60, iss: issuer });
  const body = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(body);
  signer.end();
  return `${body}.${signer.sign(key).toString("base64url")}`;
}

export function readGithubAppConfiguration(env = process.env) {
  const appId = integerId(env.GITHUB_APP_ID, "GITHUB_APP_ID");
  const slug = required(env.GITHUB_APP_SLUG, "GITHUB_APP_SLUG", 160).toLowerCase();
  if (!SAFE_SLUG.test(slug)) throw new TypeError("GITHUB_APP_SLUG is invalid.");
  const origin = normalizeOrigin(env.NEXTAUTH_URL);
  return Object.freeze({
    appId,
    slug,
    privateKey: normalizePrivateKey(env.GITHUB_APP_PRIVATE_KEY),
    clientId: required(env.GITHUB_APP_CLIENT_ID, "GITHUB_APP_CLIENT_ID", 300),
    clientSecret: required(env.GITHUB_APP_CLIENT_SECRET, "GITHUB_APP_CLIENT_SECRET", 1000),
    callbackUrl: `${origin}/api/sources/github/oauth/callback`,
  });
}

export function githubAppConfigurationStatus(env = process.env) {
  const requiredNames = [
    "GITHUB_APP_ID",
    "GITHUB_APP_SLUG",
    "GITHUB_APP_PRIVATE_KEY",
    "GITHUB_APP_CLIENT_ID",
    "GITHUB_APP_CLIENT_SECRET",
    "GITHUB_INSTALL_STATE_SECRET",
    "NEXTAUTH_URL",
    "DATABASE_URL",
  ];
  const missing = requiredNames.filter((name) => !String(env[name] || "").trim());
  return Object.freeze({ configured: missing.length === 0, missing });
}

export function buildGithubAppInstallationUrl({ slug, state } = {}) {
  const normalizedSlug = required(slug, "GitHub App slug", 160).toLowerCase();
  if (!SAFE_SLUG.test(normalizedSlug)) throw new TypeError("GitHub App slug is invalid.");
  const url = new URL(`https://github.com/apps/${normalizedSlug}/installations/new`);
  url.searchParams.set("state", required(state, "GitHub install state", 5000));
  return url.toString();
}

export function buildGithubAppUserAuthorizationUrl({ clientId, state, callbackUrl } = {}) {
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", required(clientId, "GitHub App client ID", 300));
  url.searchParams.set("state", required(state, "GitHub authorization state", 5000));
  url.searchParams.set("redirect_uri", required(callbackUrl, "GitHub App callback URL", 1000));
  return url.toString();
}

function safePermissions(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value)
    .map(([name, level]) => `${String(name).toLowerCase()}:${String(level).toLowerCase()}`)
    .filter((item) => /^[a-z0-9._:-]+$/.test(item))
    .sort();
}

function safeRepository(repo = {}) {
  const id = integerId(repo.id, "repository.id");
  const fullName = required(repo.full_name, "repository.full_name", 300);
  return Object.freeze({
    id,
    fullName,
    name: required(repo.name || fullName.split("/").pop(), "repository.name", 200),
    ownerLogin: String(repo.owner?.login || "").trim() || null,
    private: Boolean(repo.private),
    visibility: String(repo.visibility || (repo.private ? "private" : "public")).trim().toLowerCase(),
    defaultBranch: String(repo.default_branch || "").trim() || null,
    archived: Boolean(repo.archived),
    disabled: Boolean(repo.disabled),
  });
}

function safeInstallation(installation = {}) {
  const installationId = integerId(installation.id, "installation.id");
  const accountId = installation.account?.id ? integerId(installation.account.id, "installation.account.id") : null;
  return Object.freeze({
    installationId,
    accountRef: accountId,
    accountLogin: String(installation.account?.login || installation.account?.slug || "").trim() || null,
    accountType: String(installation.account?.type || "").trim().toLowerCase() || null,
    repositorySelection: String(installation.repository_selection || "").trim().toLowerCase() || null,
    permissionScopes: safePermissions(installation.permissions),
    suspended: Boolean(installation.suspended_at),
  });
}

function githubError(status, code) {
  const error = new Error(`GitHub App request failed with status ${status}.`);
  error.code = code || `github_app_http_${status}`;
  error.status = status;
  return error;
}

export function createGithubAppApiClient({
  appId,
  privateKey,
  clientId,
  clientSecret,
  callbackUrl,
  fetchImpl = globalThis.fetch,
  apiBaseUrl = "https://api.github.com",
  oauthBaseUrl = "https://github.com",
  maxRepositoryPages = 5,
  now = () => Date.now(),
} = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("GitHub App API client requires fetch().");
  const resolvedAppId = integerId(appId, "GitHub App ID");
  const resolvedPrivateKey = normalizePrivateKey(privateKey);
  const resolvedClientId = required(clientId, "GitHub App client ID", 300);
  const resolvedClientSecret = required(clientSecret, "GitHub App client secret", 1000);
  const resolvedCallbackUrl = required(callbackUrl, "GitHub App callback URL", 1000);
  const base = new URL(apiBaseUrl);
  const oauthBase = new URL(oauthBaseUrl);
  const pages = Number(maxRepositoryPages);
  if (!Number.isInteger(pages) || pages < 1 || pages > 10) throw new TypeError("maxRepositoryPages must be between 1 and 10.");

  function appAuthorization() {
    return `Bearer ${createGithubAppJwt({ appId: resolvedAppId, privateKey: resolvedPrivateKey, now: now() })}`;
  }

  async function requestJson(path, { method = "GET", authorization = appAuthorization(), body = null } = {}) {
    const response = await fetchImpl(new URL(path, base), {
      method,
      headers: {
        Accept: ACCEPT,
        Authorization: authorization,
        "X-GitHub-Api-Version": API_VERSION,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
    });
    if (!response.ok) throw githubError(response.status);
    if (response.status === 204) return null;
    return response.json();
  }

  async function getInstallation(installationId) {
    const id = integerId(installationId, "installationId");
    const installation = safeInstallation(await requestJson(`/app/installations/${id}`));
    if (installation.suspended) {
      const error = new Error("GitHub App installation is suspended.");
      error.code = "github_installation_suspended";
      throw error;
    }
    return installation;
  }

  async function exchangeUserCode(code) {
    const response = await fetchImpl(new URL("/login/oauth/access_token", oauthBase), {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: resolvedClientId,
        client_secret: resolvedClientSecret,
        code: required(code, "GitHub authorization code", 1000),
        redirect_uri: resolvedCallbackUrl,
      }),
      cache: "no-store",
    });
    if (!response.ok) throw githubError(response.status, "github_user_authorization_failed");
    const payload = await response.json();
    const token = String(payload?.access_token || "").trim();
    if (!token) throw githubError(401, "github_user_authorization_failed");
    return token;
  }

  async function verifyUserInstallationAccess(userToken, installationId) {
    const id = integerId(installationId, "installationId");
    const payload = await requestJson(`/user/installations/${id}/repositories?per_page=1`, {
      authorization: `Bearer ${required(userToken, "GitHub user access token", 10000)}`,
    });
    return Object.freeze({ totalCount: Number(payload?.total_count || 0) });
  }

  function buildUserAuthorizationUrl(state) {
    return buildGithubAppUserAuthorizationUrl({
      clientId: resolvedClientId,
      state,
      callbackUrl: resolvedCallbackUrl,
    });
  }

  async function createInstallationToken(installationId) {
    const id = integerId(installationId, "installationId");
    const payload = await requestJson(`/app/installations/${id}/access_tokens`, { method: "POST" });
    const token = required(payload?.token, "GitHub installation access token", 10000);
    return Object.freeze({ token, expiresAt: String(payload?.expires_at || "").trim() || null });
  }

  async function listInstallationRepositories(installationId) {
    const { token } = await createInstallationToken(installationId);
    const repositories = [];
    for (let page = 1; page <= pages; page += 1) {
      const payload = await requestJson(`/installation/repositories?per_page=100&page=${page}`, {
        authorization: `Bearer ${token}`,
      });
      const batch = Array.isArray(payload?.repositories) ? payload.repositories : [];
      repositories.push(...batch.map(safeRepository));
      if (batch.length < 100) break;
      if (page === pages) {
        const error = new Error("GitHub installation repository scope exceeds the safe discovery bound.");
        error.code = "github_repository_scope_too_large";
        throw error;
      }
    }
    return repositories;
  }

  async function getRepositoryForInstallation(installationId, repositoryId) {
    const id = integerId(repositoryId, "repositoryId");
    const { token } = await createInstallationToken(installationId);
    const repo = safeRepository(await requestJson(`/repositories/${id}`, { authorization: `Bearer ${token}` }));
    if (repo.id !== id) {
      const error = new Error("GitHub repository identity mismatch.");
      error.code = "github_repository_identity_mismatch";
      throw error;
    }
    return repo;
  }

  return Object.freeze({
    getInstallation,
    exchangeUserCode,
    verifyUserInstallationAccess,
    buildUserAuthorizationUrl,
    listInstallationRepositories,
    getRepositoryForInstallation,
  });
}
