import { assertPort } from "../domain/ports.mjs";
import {
  CAPTURE_RECIPE_STATUSES,
  activateCaptureRecipe,
  createCaptureRecipe,
  normalizeCaptureRecipe,
  reviseCaptureRecipe,
} from "../domain/captureRecipes.mjs";

const CAPTURE_SUBJECT_SELECTOR = "[data-signalflow-capture-subject='workspace-loading']";
const CAPTURE_ERROR_SELECTOR = "[data-signalflow-capture-error]";
const CAPTURE_UNEXPECTED_LOADING_SELECTOR = "[data-signalflow-capture-unexpected-loading]";

function requiredOpaque(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length > 200 || /[/\\]|^[a-zA-Z]:/.test(normalized)) {
    throw new TypeError(`${field} must be an opaque identifier.`);
  }
  return normalized;
}

function captureTargetOrigin(value) {
  let parsed;
  try {
    parsed = new URL(String(value || "").trim());
  } catch {
    throw new TypeError("Capture target origin must be a valid HTTPS origin.");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new TypeError("Capture target origin must be an uncredentialed HTTPS origin.");
  }
  return parsed.origin;
}

function canonicalRecipeId(projectId) {
  return `gp2-workspace-loading-${requiredOpaque(projectId, "projectId")}`;
}

function latestRecipes(items = []) {
  const latestByIdentity = new Map();
  for (const item of [...items].map(normalizeCaptureRecipe).sort((left, right) => right.version - left.version)) {
    if (!latestByIdentity.has(item.captureRecipeId)) latestByIdentity.set(item.captureRecipeId, item);
  }
  return [...latestByIdentity.values()];
}

function recipeContract({ origin, environment }) {
  return {
    name: "SignalFlow workspace loading proof",
    targetOrigin: origin,
    allowedEnvironment: environment,
    requiredCapabilities: ["screenshot"],
    secretReferenceIds: [],
    fixturePolicy: {
      allowedKeys: [],
      realUserDataAllowed: false,
    },
    privacyRules: [
      {
        code: "private-marker-visible",
        severity: "block",
        selector: "[data-private], [data-sensitive], [data-secret]",
        description: "Capture must fail if a private-content marker is visible.",
      },
      {
        code: "password-field-visible",
        severity: "block",
        selector: "input[type='password']",
        description: "Capture must fail if a password field is visible.",
      },
    ],
    expectedCheckpoints: ["workspace-loading"],
    steps: [
      {
        stepId: "open-workspace-loading-preview",
        action: "navigate",
        path: "/capture-preview/workspace-loading",
      },
      {
        stepId: "wait-for-workspace-loading",
        action: "wait_for",
        selector: CAPTURE_SUBJECT_SELECTOR,
      },
      {
        stepId: "capture-workspace-loading",
        action: "capture_checkpoint",
        checkpoint: "workspace-loading",
        qualitySelectors: {
          error: [CAPTURE_ERROR_SELECTOR],
          loading: [CAPTURE_UNEXPECTED_LOADING_SELECTOR],
          requiredSubject: [CAPTURE_SUBJECT_SELECTOR],
        },
      },
    ],
    preconditions: [
      "Use only the sanitized SignalFlow capture-preview route.",
      "Do not require owner cookies, real user data, or external navigation.",
    ],
  };
}

function contractIsCurrent(recipe, { origin, environment }) {
  const normalized = normalizeCaptureRecipe(recipe);
  const captureStep = normalized.steps.find((step) => step.action === "capture_checkpoint" && step.checkpoint === "workspace-loading");
  return normalized.targetOrigin === origin
    && normalized.allowedEnvironment === environment
    && normalized.expectedCheckpoints.length === 1
    && normalized.expectedCheckpoints[0] === "workspace-loading"
    && captureStep?.qualitySelectors?.error?.includes(CAPTURE_ERROR_SELECTOR)
    && captureStep?.qualitySelectors?.loading?.includes(CAPTURE_UNEXPECTED_LOADING_SELECTOR)
    && captureStep?.qualitySelectors?.requiredSubject?.includes(CAPTURE_SUBJECT_SELECTOR);
}

export function createProjectCaptureRecipeProvisioningApplication({
  workspaceId,
  captureRepository,
  targetOrigin,
  allowedEnvironment = "preview",
  clock,
} = {}) {
  const ownerWorkspaceId = requiredOpaque(workspaceId, "workspaceId");
  const captures = assertPort("captureRepository", captureRepository);
  const time = assertPort("clock", clock);
  const origin = captureTargetOrigin(targetOrigin);
  const environment = String(allowedEnvironment || "preview").trim().toLowerCase();

  async function ensureProjectRecipe(projectIdInput) {
    const projectId = requiredOpaque(projectIdInput, "projectId");
    const existing = await captures.listRecipes({ projectId });
    const latest = latestRecipes(existing);
    const active = latest.filter((item) => item.status === CAPTURE_RECIPE_STATUSES.ACTIVE);
    const recipeId = canonicalRecipeId(projectId);
    const canonicalExisting = latest.find((item) => item.captureRecipeId === recipeId) || null;

    if (active.length > 1) {
      const error = new Error("More than one active CaptureRecipe exists for this project.");
      error.code = "capture_recipe_ambiguous";
      error.status = 409;
      throw error;
    }
    if (active.length === 1 && active[0].captureRecipeId !== recipeId) {
      return Object.freeze({ recipe: active[0], reused: true, provisioned: false });
    }

    const now = time.now();
    const contract = recipeContract({ origin, environment });
    if (canonicalExisting?.status === CAPTURE_RECIPE_STATUSES.ACTIVE) {
      if (contractIsCurrent(canonicalExisting, { origin, environment })) {
        return Object.freeze({ recipe: canonicalExisting, reused: true, provisioned: false });
      }
      const revised = activateCaptureRecipe(reviseCaptureRecipe(canonicalExisting, contract, now), now);
      const stored = await captures.upsertRecipe(revised);
      return Object.freeze({ recipe: stored, reused: false, provisioned: true, revised: true });
    }
    if (canonicalExisting) {
      const error = new Error("The canonical project CaptureRecipe exists but is not active.");
      error.code = "capture_recipe_owner_action_required";
      error.status = 409;
      throw error;
    }

    const recipe = activateCaptureRecipe(createCaptureRecipe({
      captureRecipeId: recipeId,
      workspaceId: ownerWorkspaceId,
      projectId,
      ...contract,
      createdAt: now,
      updatedAt: now,
    }), now);

    const stored = await captures.upsertRecipe(recipe);
    return Object.freeze({ recipe: stored, reused: false, provisioned: true, revised: false });
  }

  return Object.freeze({ ensureProjectRecipe });
}

export function createProvisioningCaptureRepository({
  captureRepository,
  provisioningApplication,
} = {}) {
  const captures = assertPort("captureRepository", captureRepository);
  if (!provisioningApplication || typeof provisioningApplication.ensureProjectRecipe !== "function") {
    throw new TypeError("Provisioning capture repository requires ensureProjectRecipe().");
  }

  return assertPort("captureRepository", {
    async listRecipes(options = {}) {
      const projectId = String(options?.projectId || "").trim();
      if (projectId && !options?.captureRecipeId) {
        await provisioningApplication.ensureProjectRecipe(projectId);
      }
      return captures.listRecipes(options);
    },
    getRecipe: (...args) => captures.getRecipe(...args),
    upsertRecipe: (...args) => captures.upsertRecipe(...args),
    listJobs: (...args) => captures.listJobs(...args),
    getJob: (...args) => captures.getJob(...args),
    upsertJob: (...args) => captures.upsertJob(...args),
  });
}
