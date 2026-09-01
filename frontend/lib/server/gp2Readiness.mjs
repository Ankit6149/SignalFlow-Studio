import { githubSourceConnectionConfigurationStatus } from "./githubConnectionDependencies.mjs";
import { hostedAssetStorageConfigurationStatus } from "./hostedAssetPreviewDependencies.mjs";
import { hostedScreenshotConfigurationStatus } from "./hostedScreenshotProductionDependencies.mjs";

const INFERENCE_ENV_GROUPS = Object.freeze([
  ["OPENAI_API_KEY"],
  ["ANTHROPIC_API_KEY", "CLAUDE_API_KEY"],
  ["GEMINI_API_KEY"],
  ["GROQ_API_KEY"],
  ["OPENROUTER_API_KEY"],
  ["CUSTOM_OPENAI_BASE_URL", "CUSTOM_OPENAI_API_KEY"],
]);

function present(env, name) {
  return Boolean(String(env?.[name] || "").trim());
}

function groupReady(env, group) {
  return group.every((name) => present(env, name));
}

function check(id, label, configured, missing = [], details = {}) {
  return Object.freeze({
    id,
    label,
    configured: Boolean(configured),
    missing: [...new Set((Array.isArray(missing) ? missing : []).map(String).filter(Boolean))].sort(),
    ...details,
  });
}

export function gp2ReadinessStatus(env = process.env) {
  const github = githubSourceConnectionConfigurationStatus(env);
  const storage = hostedAssetStorageConfigurationStatus(env);
  let capture;
  try {
    capture = hostedScreenshotConfigurationStatus(env);
  } catch {
    capture = { configured: false, missing: ["SIGNALFLOW_CAPTURE_ENVIRONMENT"] };
  }

  const database = check("database", "Durable database", present(env, "DATABASE_URL"), present(env, "DATABASE_URL") ? [] : ["DATABASE_URL"]);
  const ownerLockRequired = ["1", "true", "yes", "on"].includes(String(env?.SIGNALFLOW_PUBLIC_HOSTED || "").trim().toLowerCase());
  const ownerLock = check(
    "owner_lock",
    "Owner access lock",
    !ownerLockRequired || present(env, "SIGNALFLOW_ACCESS_KEY"),
    ownerLockRequired && !present(env, "SIGNALFLOW_ACCESS_KEY") ? ["SIGNALFLOW_ACCESS_KEY"] : [],
  );
  const githubApp = check("github_app", "GitHub App connection", github.configured, github.missing);
  const webhook = check("github_webhook", "GitHub webhook verification", present(env, "GITHUB_WEBHOOK_SECRET"), present(env, "GITHUB_WEBHOOK_SECRET") ? [] : ["GITHUB_WEBHOOK_SECRET"]);
  const privateStorage = check("private_asset_storage", "Private Asset storage", storage.configured, storage.missing);
  const captureWorker = check(
    "capture_worker",
    "Bounded screenshot worker",
    capture.configured,
    capture.missing,
    { environment: capture.environment || null },
  );
  const previewSecretReady = String(env?.SIGNALFLOW_MEDIA_PREVIEW_RECEIPT_SECRET || "").trim().length >= 32;
  const exactPreview = check(
    "exact_media_preview",
    "Exact media visibility receipts",
    previewSecretReady,
    previewSecretReady ? [] : ["SIGNALFLOW_MEDIA_PREVIEW_RECEIPT_SECRET"],
  );
  const inferenceReady = INFERENCE_ENV_GROUPS.some((group) => groupReady(env, group));
  const inference = check(
    "inference",
    "Hosted inference route",
    inferenceReady,
    inferenceReady ? [] : ["OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY|GROQ_API_KEY|OPENROUTER_API_KEY|CUSTOM_OPENAI_BASE_URL+CUSTOM_OPENAI_API_KEY"],
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
  const missing = [...new Set(checks.flatMap((item) => item.missing))].sort();

  return Object.freeze({
    ready: checks.every((item) => item.configured),
    checks,
    missing,
  });
}
