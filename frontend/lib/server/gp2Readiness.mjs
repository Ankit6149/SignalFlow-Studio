import { githubSourceConnectionConfigurationStatus } from "./githubConnectionDependencies.mjs";
import { hostedAssetStorageConfigurationStatus } from "./hostedAssetPreviewDependencies.mjs";
import { hostedScreenshotConfigurationStatus } from "./hostedScreenshotProductionDependencies.mjs";
import { ownerAccessConfigurationStatus } from "./ownerAccessPolicy.mjs";
import { resolveMediaPreviewReceiptSecret } from "./runtimeSigningSecrets.mjs";

const INFERENCE_ENV_GROUPS = Object.freeze([
  ["VERCEL_OIDC_TOKEN"],
  ["AI_GATEWAY_API_KEY"],
  ["OPENAI_API_KEY"],
  ["ANTHROPIC_API_KEY", "CLAUDE_API_KEY"],
  ["GEMINI_API_KEY"],
  ["GROQ_API_KEY"],
  ["OPENROUTER_API_KEY"],
  ["CUSTOM_OPENAI_BASE_URL", "CUSTOM_OPENAI_API_KEY"],
]);

const UPSTREAM_CONFIGURATION = Object.freeze({
  DATABASE_URL: "database",
  SIGNALFLOW_ACCESS_KEY: "owner_lock",
});

function present(env, name) {
  return Boolean(String(env?.[name] || "").trim());
}

function groupReady(env, group) {
  return group.every((name) => present(env, name));
}

function unique(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map(String).filter(Boolean))].sort();
}

function check(id, label, configured, missing = [], details = {}) {
  return Object.freeze({
    id,
    label,
    configured: Boolean(configured),
    missing: unique(missing),
    blockedBy: unique(details.blockedBy),
    ...details,
    blockedBy: unique(details.blockedBy),
  });
}

function splitUpstreamMissing(missing = [], readiness = {}) {
  const directMissing = [];
  const blockedBy = [];
  for (const name of unique(missing)) {
    const upstream = UPSTREAM_CONFIGURATION[name];
    if (upstream && readiness[upstream] === false) blockedBy.push(upstream);
    else directMissing.push(name);
  }
  return Object.freeze({ directMissing: unique(directMissing), blockedBy: unique(blockedBy) });
}

export function gp2ReadinessStatus(env = process.env, { vercelOidcAvailable = false } = {}) {
  const github = githubSourceConnectionConfigurationStatus(env);
  const storage = hostedAssetStorageConfigurationStatus(env);
  const ownerAccess = ownerAccessConfigurationStatus(env);
  let capture;
  try {
    capture = hostedScreenshotConfigurationStatus(env);
  } catch {
    capture = { configured: false, missing: ["SIGNALFLOW_CAPTURE_ENVIRONMENT"] };
  }

  const databaseReady = present(env, "DATABASE_URL");
  const database = check("database", "Durable database", databaseReady, databaseReady ? [] : ["DATABASE_URL"]);

  const ownerLockReady = !ownerAccess.publicHosted || ownerAccess.configured;
  const ownerLock = check(
    "owner_lock",
    "Owner access lock",
    ownerLockReady,
    ownerLockReady ? [] : ["SIGNALFLOW_ACCESS_KEY"],
  );

  const upstreamReadiness = { database: databaseReady, owner_lock: ownerLockReady };
  const githubRequirements = splitUpstreamMissing(github.missing, upstreamReadiness);
  const githubApp = check(
    "github_app",
    "GitHub App connection",
    github.configured && githubRequirements.blockedBy.length === 0,
    githubRequirements.directMissing,
    { blockedBy: githubRequirements.blockedBy },
  );

  const webhook = check(
    "github_webhook",
    "GitHub webhook verification",
    present(env, "GITHUB_WEBHOOK_SECRET"),
    present(env, "GITHUB_WEBHOOK_SECRET") ? [] : ["GITHUB_WEBHOOK_SECRET"],
  );

  const storageRequirements = splitUpstreamMissing(storage.missing, upstreamReadiness);
  const privateStorage = check(
    "private_asset_storage",
    "Private Asset storage",
    storage.configured && storageRequirements.blockedBy.length === 0,
    storageRequirements.directMissing,
    { provider: storage.provider || null, blockedBy: storageRequirements.blockedBy },
  );

  const captureWorker = check(
    "capture_worker",
    "Bounded screenshot worker",
    capture.configured,
    capture.missing,
    { environment: capture.environment || null },
  );

  const previewSecretReady = resolveMediaPreviewReceiptSecret(env).length >= 32;
  const exactPreview = check(
    "exact_media_preview",
    "Exact media visibility receipts",
    previewSecretReady,
    previewSecretReady ? [] : ["SIGNALFLOW_MEDIA_PREVIEW_RECEIPT_SECRET|SIGNALFLOW_ACCESS_KEY"],
  );

  const inferenceReady = Boolean(vercelOidcAvailable) || INFERENCE_ENV_GROUPS.some((group) => groupReady(env, group));
  const inference = check(
    "inference",
    "Hosted inference route",
    inferenceReady,
    inferenceReady ? [] : ["VERCEL_RUNTIME_OIDC|AI_GATEWAY_API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY|GROQ_API_KEY|OPENROUTER_API_KEY|CUSTOM_OPENAI_BASE_URL+CUSTOM_OPENAI_API_KEY"],
    { provider: Boolean(vercelOidcAvailable) ? "vercel_oidc" : null },
  );

  const checks = Object.freeze([
    database,
    ownerLock,
    githubApp,
    webhook,
    privateStorage,
    captureWorker,
    exactPreview,
    inference,
  ]);
  const missing = unique(checks.flatMap((item) => item.missing));

  return Object.freeze({
    ready: checks.every((item) => item.configured),
    checks,
    missing,
  });
}
