import { createDomainRecord, parseDomainRecord, portableClone } from "./contracts.mjs";
import { JOB_TYPES, createDurableJob } from "./durableJobs.mjs";

export const CAPTURE_SCHEMA_VERSION = 1;

export const CAPTURE_ENVIRONMENTS = Object.freeze({
  DEMO: "demo",
  PREVIEW: "preview",
  TRUSTED_OWNER: "trusted_owner",
});

export const CAPTURE_RECIPE_STATUSES = Object.freeze({
  DRAFT: "draft",
  ACTIVE: "active",
  SUPERSEDED: "superseded",
  REVOKED: "revoked",
});

export const CAPTURE_JOB_STATUSES = Object.freeze({
  QUEUED: "queued",
  PREPARING_ENVIRONMENT: "preparing_environment",
  LAUNCHING_BROWSER: "launching_browser",
  NAVIGATING: "navigating",
  WAITING_FOR_CHECKPOINT: "waiting_for_checkpoint",
  CAPTURING: "capturing",
  PROCESSING_OUTPUT: "processing_output",
  SUCCEEDED: "succeeded",
  PARTIALLY_SUCCEEDED: "partially_succeeded",
  FAILED: "failed",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
});

export const CAPTURE_ACTIONS = Object.freeze({
  NAVIGATE: "navigate",
  WAIT_FOR: "wait_for",
  CLICK: "click",
  FOCUS: "focus",
  FILL_SAFE_FIXTURE: "fill_safe_fixture",
  SELECT: "select",
  SCROLL: "scroll",
  PAUSE_FOR_CAPTURE: "pause_for_capture",
  ASSERT_VISIBLE: "assert_visible",
  CAPTURE_CHECKPOINT: "capture_checkpoint",
  START_RECORDING: "start_recording",
  STOP_RECORDING: "stop_recording",
});

const ENVIRONMENT_VALUES = new Set(Object.values(CAPTURE_ENVIRONMENTS));
const RECIPE_STATUS_VALUES = new Set(Object.values(CAPTURE_RECIPE_STATUSES));
const CAPTURE_JOB_STATUS_VALUES = new Set(Object.values(CAPTURE_JOB_STATUSES));
const ACTION_VALUES = new Set(Object.values(CAPTURE_ACTIONS));
const SAFE_CODE = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

export class CaptureRecipeError extends TypeError {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "CaptureRecipeError";
    this.code = code;
    this.details = portableClone(details);
  }
}

function text(value, fallback = "", maxLength = 1600) {
  const normalized = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  const resolved = normalized || fallback;
  if (resolved.length > maxLength) throw new CaptureRecipeError("capture_text_too_long", `Capture field exceeds ${maxLength} characters.`);
  return resolved;
}

function opaqueId(value, field, required = true) {
  const normalized = text(value, "", 240);
  if (!normalized && !required) return null;
  if (!normalized) throw new CaptureRecipeError("missing_capture_id", `${field} is required.`, { field });
  if (/[/\\]|^[a-zA-Z]:/.test(normalized)) throw new CaptureRecipeError("non_opaque_capture_id", `${field} must be an opaque ID.`, { field });
  return normalized;
}

function timestamp(value, fallback = null, field = "timestamp") {
  const candidate = value || fallback;
  if (!candidate) return null;
  const parsed = Date.parse(candidate);
  if (!Number.isFinite(parsed)) throw new CaptureRecipeError("invalid_capture_timestamp", `${field} must be an ISO timestamp.`, { field });
  return new Date(parsed).toISOString();
}

function enumValue(value, allowed, fallback, field) {
  const normalized = text(value, fallback, 100).toLowerCase();
  if (!allowed.has(normalized)) throw new CaptureRecipeError("invalid_capture_enum", `${field} contains unsupported value: ${normalized}.`, { field, value: normalized });
  return normalized;
}

function normalizeOrigin(value) {
  let parsed;
  try {
    parsed = new URL(text(value, "", 500));
  } catch {
    throw new CaptureRecipeError("invalid_capture_origin", "CaptureRecipe.targetOrigin must be a valid HTTP(S) origin.");
  }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new CaptureRecipeError("unsafe_capture_origin", "CaptureRecipe.targetOrigin must be an uncredentialed HTTP(S) origin.");
  }
  parsed.pathname = "/";
  parsed.search = "";
  parsed.hash = "";
  return parsed.origin;
}

function safeCode(value, field) {
  const normalized = text(value, "", 120).toLowerCase();
  if (!SAFE_CODE.test(normalized)) throw new CaptureRecipeError("invalid_capture_code", `${field} must be a stable lowercase identifier.`, { field });
  return normalized;
}

function uniqueCodes(values, field, max = 50) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => safeCode(value, field)))].slice(0, max);
}

function normalizePrivacyRules(values) {
  if (!Array.isArray(values)) return [];
  return values.slice(0, 50).map((item, index) => {
    if (typeof item === "string") return { code: safeCode(item, `privacyRules[${index}]`), severity: "block", selector: null };
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new CaptureRecipeError("invalid_privacy_rule", "Capture privacy rules must be strings or objects.");
    return portableClone({
      code: safeCode(item.code, `privacyRules[${index}].code`),
      severity: enumValue(item.severity, new Set(["block", "warn"]), "block", `privacyRules[${index}].severity`),
      selector: text(item.selector, "", 500) || null,
      description: text(item.description, "", 700) || null,
    });
  });
}

function normalizeStep(item, index) {
  if (!item || typeof item !== "object" || Array.isArray(item)) throw new CaptureRecipeError("invalid_capture_step", `Capture step ${index + 1} must be an object.`);
  const action = enumValue(item.action, ACTION_VALUES, CAPTURE_ACTIONS.ASSERT_VISIBLE, `steps[${index}].action`);
  if (["evaluate", "javascript", "script", "shell", "exec"].includes(action)) throw new CaptureRecipeError("arbitrary_capture_execution_forbidden", "Capture recipes cannot contain arbitrary executable code.");
  const stepId = safeCode(item.stepId || `step-${index + 1}`, `steps[${index}].stepId`);
  const selectorActions = new Set([CAPTURE_ACTIONS.WAIT_FOR, CAPTURE_ACTIONS.CLICK, CAPTURE_ACTIONS.FOCUS, CAPTURE_ACTIONS.SELECT, CAPTURE_ACTIONS.ASSERT_VISIBLE]);
  const selector = text(item.selector, "", 500) || null;
  if (selectorActions.has(action) && !selector) throw new CaptureRecipeError("capture_selector_required", `${action} requires a selector.`, { stepId });
  if (action === CAPTURE_ACTIONS.NAVIGATE && !text(item.path, "", 1000)) throw new CaptureRecipeError("capture_navigation_path_required", "navigate requires a path or URL relative to the approved origin.", { stepId });
  if (action === CAPTURE_ACTIONS.FILL_SAFE_FIXTURE && !safeCode(item.fixtureKey, `steps[${index}].fixtureKey`)) throw new CaptureRecipeError("capture_fixture_required", "fill_safe_fixture requires a fixtureKey.", { stepId });
  if (action === CAPTURE_ACTIONS.CAPTURE_CHECKPOINT && !safeCode(item.checkpoint, `steps[${index}].checkpoint`)) throw new CaptureRecipeError("capture_checkpoint_required", "capture_checkpoint requires a checkpoint name.", { stepId });
  return portableClone({
    stepId,
    action,
    selector,
    path: text(item.path, "", 1000) || null,
    fixtureKey: item.fixtureKey ? safeCode(item.fixtureKey, `steps[${index}].fixtureKey`) : null,
    optionValue: text(item.optionValue, "", 500) || null,
    scrollY: Number.isFinite(Number(item.scrollY)) ? Math.round(Number(item.scrollY)) : null,
    pauseMs: Number.isFinite(Number(item.pauseMs)) ? Math.max(0, Math.min(15000, Math.round(Number(item.pauseMs)))) : null,
    checkpoint: item.checkpoint ? safeCode(item.checkpoint, `steps[${index}].checkpoint`) : null,
    optional: item.optional === true,
  });
}

export function normalizeCaptureRecipe(input = {}) {
  const parsed = input?.kind === "CaptureRecipe" && input?.schemaVersion ? parseDomainRecord(input, "CaptureRecipe") : input;
  const createdAt = timestamp(parsed.createdAt, null, "CaptureRecipe.createdAt");
  if (!createdAt) throw new CaptureRecipeError("capture_created_at_required", "CaptureRecipe.createdAt is required.");
  if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) throw new CaptureRecipeError("capture_steps_required", "CaptureRecipe requires at least one bounded step.");
  const steps = parsed.steps.slice(0, 200).map(normalizeStep);
  const checkpointSteps = new Set(steps.filter((step) => step.checkpoint).map((step) => step.checkpoint));
  const expectedCheckpoints = uniqueCodes(parsed.expectedCheckpoints, "CaptureRecipe.expectedCheckpoints", 100);
  for (const checkpoint of expectedCheckpoints) {
    if (!checkpointSteps.has(checkpoint)) throw new CaptureRecipeError("capture_checkpoint_not_declared", `Expected checkpoint ${checkpoint} is not produced by a recipe step.`);
  }
  return createDomainRecord("CaptureRecipe", {
    captureSchemaVersion: CAPTURE_SCHEMA_VERSION,
    captureRecipeId: opaqueId(parsed.captureRecipeId, "CaptureRecipe.captureRecipeId"),
    workspaceId: opaqueId(parsed.workspaceId, "CaptureRecipe.workspaceId"),
    projectId: opaqueId(parsed.projectId, "CaptureRecipe.projectId"),
    name: text(parsed.name, "Capture recipe", 240),
    version: Number.isInteger(parsed.version) && parsed.version > 0 ? parsed.version : 1,
    targetOrigin: normalizeOrigin(parsed.targetOrigin),
    allowedEnvironment: enumValue(parsed.allowedEnvironment, ENVIRONMENT_VALUES, CAPTURE_ENVIRONMENTS.DEMO, "CaptureRecipe.allowedEnvironment"),
    steps,
    preconditions: Array.isArray(parsed.preconditions) ? parsed.preconditions.slice(0, 40).map((item) => text(item, "", 700)).filter(Boolean) : [],
    requiredCapabilities: uniqueCodes(parsed.requiredCapabilities, "CaptureRecipe.requiredCapabilities", 40),
    secretReferenceIds: Array.isArray(parsed.secretReferenceIds) ? [...new Set(parsed.secretReferenceIds.map((item) => opaqueId(item, "CaptureRecipe.secretReferenceIds")))].slice(0, 20) : [],
    fixturePolicy: portableClone({
      allowedKeys: uniqueCodes(parsed.fixturePolicy?.allowedKeys, "CaptureRecipe.fixturePolicy.allowedKeys", 100),
      realUserDataAllowed: parsed.fixturePolicy?.realUserDataAllowed === true && parsed.allowedEnvironment === CAPTURE_ENVIRONMENTS.TRUSTED_OWNER,
    }),
    privacyRules: normalizePrivacyRules(parsed.privacyRules),
    expectedCheckpoints,
    maxDurationSeconds: Number.isFinite(Number(parsed.maxDurationSeconds)) ? Math.max(5, Math.min(600, Math.round(Number(parsed.maxDurationSeconds)))) : 120,
    status: enumValue(parsed.status, RECIPE_STATUS_VALUES, CAPTURE_RECIPE_STATUSES.DRAFT, "CaptureRecipe.status"),
    createdAt,
    updatedAt: timestamp(parsed.updatedAt, createdAt, "CaptureRecipe.updatedAt"),
  });
}

export function createCaptureRecipe(input = {}) {
  return normalizeCaptureRecipe({ ...input, version: 1, status: input.status || CAPTURE_RECIPE_STATUSES.DRAFT });
}

export function reviseCaptureRecipe(recipeInput, patch = {}, now) {
  const recipe = normalizeCaptureRecipe(recipeInput);
  if (recipe.status === CAPTURE_RECIPE_STATUSES.REVOKED) throw new CaptureRecipeError("capture_recipe_revoked", "A revoked capture recipe cannot be revised in place.");
  return normalizeCaptureRecipe({
    ...recipe,
    ...patch,
    version: recipe.version + 1,
    status: patch.status || CAPTURE_RECIPE_STATUSES.DRAFT,
    updatedAt: timestamp(now, recipe.updatedAt, "CaptureRecipe.updatedAt"),
  });
}

export function activateCaptureRecipe(recipeInput, now) {
  const recipe = normalizeCaptureRecipe(recipeInput);
  return normalizeCaptureRecipe({ ...recipe, status: CAPTURE_RECIPE_STATUSES.ACTIVE, updatedAt: timestamp(now, recipe.updatedAt, "CaptureRecipe.updatedAt") });
}

export function normalizeCaptureJob(input = {}) {
  const parsed = input?.kind === "CaptureJob" && input?.schemaVersion ? parseDomainRecord(input, "CaptureJob") : input;
  const createdAt = timestamp(parsed.createdAt, null, "CaptureJob.createdAt");
  if (!createdAt) throw new CaptureRecipeError("capture_job_created_at_required", "CaptureJob.createdAt is required.");
  return createDomainRecord("CaptureJob", {
    captureSchemaVersion: CAPTURE_SCHEMA_VERSION,
    captureJobId: opaqueId(parsed.captureJobId, "CaptureJob.captureJobId"),
    workspaceId: opaqueId(parsed.workspaceId, "CaptureJob.workspaceId"),
    projectId: opaqueId(parsed.projectId, "CaptureJob.projectId", false),
    captureRecipeId: opaqueId(parsed.captureRecipeId, "CaptureJob.captureRecipeId"),
    captureRecipeVersion: Number.isInteger(parsed.captureRecipeVersion) && parsed.captureRecipeVersion > 0 ? parsed.captureRecipeVersion : 1,
    jobId: opaqueId(parsed.jobId, "CaptureJob.jobId"),
    captureKind: enumValue(parsed.captureKind, new Set(["screenshot", "screencast"]), "screenshot", "CaptureJob.captureKind"),
    requestedCheckpoint: parsed.requestedCheckpoint ? safeCode(parsed.requestedCheckpoint, "CaptureJob.requestedCheckpoint") : null,
    status: enumValue(parsed.status, CAPTURE_JOB_STATUS_VALUES, CAPTURE_JOB_STATUSES.QUEUED, "CaptureJob.status"),
    issueCode: parsed.issueCode ? safeCode(parsed.issueCode, "CaptureJob.issueCode") : null,
    outputAssetIds: Array.isArray(parsed.outputAssetIds) ? [...new Set(parsed.outputAssetIds.map((item) => opaqueId(item, "CaptureJob.outputAssetIds")))].slice(0, 50) : [],
    createdAt,
    updatedAt: timestamp(parsed.updatedAt, createdAt, "CaptureJob.updatedAt"),
    completedAt: timestamp(parsed.completedAt, null, "CaptureJob.completedAt"),
  });
}

export function createCaptureJob({ captureJobId, jobId, recipe, captureKind = "screenshot", requestedCheckpoint = null, createdAt, idempotencyKey, actorRef = null, correlationId = null } = {}) {
  const normalizedRecipe = normalizeCaptureRecipe(recipe);
  if (normalizedRecipe.status !== CAPTURE_RECIPE_STATUSES.ACTIVE) throw new CaptureRecipeError("capture_recipe_not_active", "Capture execution requires an active CaptureRecipe.");
  if (requestedCheckpoint && !normalizedRecipe.expectedCheckpoints.includes(requestedCheckpoint)) throw new CaptureRecipeError("capture_checkpoint_not_allowed", `Checkpoint ${requestedCheckpoint} is not declared by the recipe.`);
  const captureJob = normalizeCaptureJob({
    captureJobId,
    workspaceId: normalizedRecipe.workspaceId,
    projectId: normalizedRecipe.projectId,
    captureRecipeId: normalizedRecipe.captureRecipeId,
    captureRecipeVersion: normalizedRecipe.version,
    jobId,
    captureKind,
    requestedCheckpoint,
    status: CAPTURE_JOB_STATUSES.QUEUED,
    createdAt,
    updatedAt: createdAt,
  });
  const durableJob = createDurableJob({
    jobId,
    workspaceId: normalizedRecipe.workspaceId,
    actorRef,
    resourceType: "capture_job",
    resourceId: captureJobId,
    jobType: captureKind === "screencast" ? JOB_TYPES.CAPTURE_SCREENCAST : JOB_TYPES.CAPTURE_SCREENSHOT,
    inputVersion: normalizedRecipe.version,
    inputRef: normalizedRecipe.captureRecipeId,
    idempotencyKey,
    correlationId,
    createdAt,
  });
  return { captureJob, durableJob };
}

export function resolveRecipeNavigation(recipeInput, path) {
  const recipe = normalizeCaptureRecipe(recipeInput);
  let target;
  try {
    target = new URL(text(path, "", 1000), `${recipe.targetOrigin}/`);
  } catch {
    throw new CaptureRecipeError("capture_navigation_invalid", "Capture navigation target is invalid.");
  }
  if (target.origin !== recipe.targetOrigin) throw new CaptureRecipeError("origin_changed", "Capture recipe attempted to leave its approved origin.");
  return target.toString();
}

export function validateCaptureRuntime({ recipe: recipeInput, environment, availableCapabilities = [], fixtureKeys = [] } = {}) {
  const recipe = normalizeCaptureRecipe(recipeInput);
  if (recipe.status !== CAPTURE_RECIPE_STATUSES.ACTIVE) throw new CaptureRecipeError("capture_recipe_not_active", "CaptureRecipe must be active before execution.");
  const normalizedEnvironment = enumValue(environment, ENVIRONMENT_VALUES, CAPTURE_ENVIRONMENTS.DEMO, "capture.environment");
  if (normalizedEnvironment !== recipe.allowedEnvironment) throw new CaptureRecipeError("unauthorized_target", `Recipe is restricted to ${recipe.allowedEnvironment}, not ${normalizedEnvironment}.`);
  const capabilities = new Set(uniqueCodes(availableCapabilities, "capture.availableCapabilities", 100));
  const missingCapabilities = recipe.requiredCapabilities.filter((capability) => !capabilities.has(capability));
  if (missingCapabilities.length) throw new CaptureRecipeError("capture_capability_missing", "Capture worker is missing required capabilities.", { missingCapabilities });
  const availableFixtures = new Set(uniqueCodes(fixtureKeys, "capture.fixtureKeys", 200));
  for (const step of recipe.steps.filter((item) => item.action === CAPTURE_ACTIONS.FILL_SAFE_FIXTURE)) {
    if (!recipe.fixturePolicy.allowedKeys.includes(step.fixtureKey) || !availableFixtures.has(step.fixtureKey)) throw new CaptureRecipeError("fixture_unavailable", `Safe fixture ${step.fixtureKey} is not available for this capture.`);
  }
  return true;
}
