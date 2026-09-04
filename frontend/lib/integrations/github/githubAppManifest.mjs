const API_VERSION = "2026-03-10";
const ACCEPT = "application/vnd.github+json";
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_STATE = /^[A-Za-z0-9._~-]{20,5000}$/;

function required(value, field, maxLength = 10000) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new TypeError(`${field} is required.`);
  if (normalized.length > maxLength) throw new TypeError(`${field} is too long.`);
  return normalized;
}

function originValue(value) {
  const url = new URL(required(value, "SignalFlow origin", 1000));
  if (!new Set(["https:", "http:"]).has(url.protocol)) throw new TypeError("SignalFlow origin must use http or https.");
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function numeric(value, field) {
  const normalized = required(value, field, 80);
  if (!/^\d+$/.test(normalized)) throw new TypeError(`${field} must be numeric.`);
  return normalized;
}

function privateKey(value) {
  const normalized = required(value, "GitHub App PEM", 100000).replace(/\\n/g, "\n");
  if (!normalized.includes("BEGIN") || !normalized.includes("PRIVATE KEY")) {
    throw new TypeError("GitHub manifest conversion did not return a PEM private key.");
  }
  return normalized;
}

function stateValue(value) {
  const state = required(value, "GitHub manifest state", 5000);
  if (!SAFE_STATE.test(state)) throw new TypeError("GitHub manifest state contains unsupported characters.");
  return state;
}

export function buildSignalFlowGithubAppManifest({ origin, appName = "SignalFlow Studio" } = {}) {
  const base = originValue(origin);
  const name = required(appName, "GitHub App name", 100);
  return Object.freeze({
    name,
    url: base,
    description: "Private SignalFlow source connection for turning meaningful repository work into owner-reviewed content opportunities.",
    hook_attributes: Object.freeze({
      url: `${base}/api/sources/github/webhook`,
      active: true,
    }),
    redirect_url: `${base}/api/sources/github/manifest/callback`,
    callback_urls: Object.freeze([`${base}/api/sources/github/oauth/callback`]),
    setup_url: `${base}/api/sources/github/callback`,
    public: false,
    default_events: Object.freeze(["pull_request", "release"]),
    default_permissions: Object.freeze({
      metadata: "read",
      contents: "read",
      pull_requests: "read",
    }),
    request_oauth_on_install: false,
    setup_on_update: false,
  });
}

export function buildGithubManifestRegistration({ state, manifest, account = null } = {}) {
  const safeState = stateValue(state);
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new TypeError("GitHub App manifest must be an object.");
  }
  const action = account
    ? `https://github.com/organizations/${encodeURIComponent(required(account, "GitHub organization", 200))}/settings/apps/new`
    : "https://github.com/settings/apps/new";
  return Object.freeze({
    action,
    fields: Object.freeze({
      manifest: JSON.stringify(manifest),
      state: safeState,
    }),
  });
}

export function normalizeGithubManifestCredentials(payload = {}, { origin } = {}) {
  const base = originValue(origin);
  const slug = required(payload.slug, "GitHub App slug", 160).toLowerCase();
  if (!SAFE_SLUG.test(slug)) throw new TypeError("GitHub manifest conversion returned an invalid App slug.");
  return Object.freeze({
    appId: numeric(payload.id, "GitHub App ID"),
    slug,
    privateKey: privateKey(payload.pem),
    clientId: required(payload.client_id, "GitHub App client ID", 300),
    clientSecret: required(payload.client_secret, "GitHub App client secret", 2000),
    webhookSecret: required(payload.webhook_secret, "GitHub App webhook secret", 2000),
    callbackUrl: `${base}/api/sources/github/oauth/callback`,
  });
}

export async function exchangeGithubManifestCode({
  code,
  origin,
  fetchImpl = globalThis.fetch,
  apiBaseUrl = "https://api.github.com",
} = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("GitHub manifest conversion requires fetch().");
  const manifestCode = required(code, "GitHub manifest code", 1000);
  const response = await fetchImpl(new URL(`/app-manifests/${encodeURIComponent(manifestCode)}/conversions`, apiBaseUrl), {
    method: "POST",
    headers: {
      Accept: ACCEPT,
      "X-GitHub-Api-Version": API_VERSION,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const error = new Error(`GitHub manifest conversion failed with status ${response.status}.`);
    error.code = `github_manifest_http_${response.status}`;
    error.status = response.status;
    throw error;
  }
  return normalizeGithubManifestCredentials(await response.json(), { origin });
}
