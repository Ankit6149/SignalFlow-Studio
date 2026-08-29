import test from "node:test";
import assert from "node:assert/strict";

import { createDeterministicIdService } from "../lib/domain/ports.mjs";
import {
  CAPTURE_RECIPE_STATUSES,
  CaptureRecipeError,
  activateCaptureRecipe,
  createCaptureJob,
  createCaptureRecipe,
  resolveRecipeNavigation,
  reviseCaptureRecipe,
  validateCaptureRuntime,
} from "../lib/domain/captureRecipes.mjs";
import { JOB_STATUSES, enqueueDurableJob } from "../lib/domain/durableJobs.mjs";
import { createCaptureExecutionApplication } from "../lib/application/captureExecutionApplication.mjs";
import {
  createMemoryCaptureRepository,
  createMemoryDurableJobPort,
} from "../lib/infrastructure/productExecutionMemoryAdapters.mjs";
import { createDeterministicCaptureWorkerAdapter } from "../lib/infrastructure/deterministicCaptureWorkerAdapter.mjs";
import { createMemoryAssetRepository } from "../lib/infrastructure/transferAdapters.mjs";
import { createMemoryBlobStorage } from "../lib/infrastructure/adapters.mjs";

const T0 = "2026-08-23T00:00:00.000Z";

function draftRecipe(overrides = {}) {
  return createCaptureRecipe({
    captureRecipeId: overrides.captureRecipeId || "recipe-1",
    workspaceId: "workspace-1",
    projectId: "project-1",
    name: "Product hero capture",
    targetOrigin: overrides.targetOrigin || "https://preview.example.test",
    allowedEnvironment: overrides.allowedEnvironment || "demo",
    requiredCapabilities: overrides.requiredCapabilities || ["screenshot"],
    secretReferenceIds: overrides.secretReferenceIds || ["secret-ref-demo-session"],
    fixturePolicy: overrides.fixturePolicy || { allowedKeys: ["demo-title"], realUserDataAllowed: false },
    privacyRules: overrides.privacyRules || [{ code: "hide-personal-email", severity: "block", selector: "[data-private-email]" }],
    expectedCheckpoints: overrides.expectedCheckpoints || ["hero"],
    steps: overrides.steps || [
      { stepId: "open-demo", action: "navigate", path: "/demo" },
      { stepId: "wait-app", action: "assert_visible", selector: "#app" },
      { stepId: "capture-hero", action: "capture_checkpoint", checkpoint: "hero" },
    ],
    createdAt: T0,
    updatedAt: T0,
  });
}

function activeRecipe(overrides = {}) {
  return activateCaptureRecipe(draftRecipe(overrides), "2026-08-23T00:00:01.000Z");
}

function clock() {
  let tick = 2;
  return {
    now() {
      const result = new Date(Date.parse(T0) + tick * 1000).toISOString();
      tick += 1;
      return result;
    },
  };
}

test("capture recipes only allow bounded action vocabulary", () => {
  assert.throws(() => draftRecipe({
    steps: [{ stepId: "bad", action: "javascript", path: "alert(1)" }],
    expectedCheckpoints: [],
  }), (error) => error instanceof CaptureRecipeError && error.code === "invalid_capture_enum");
});

test("safe fixture fills are selector-bound in the canonical recipe contract", () => {
  assert.throws(() => draftRecipe({
    steps: [
      { stepId: "fill", action: "fill_safe_fixture", fixtureKey: "demo-title" },
      { stepId: "capture", action: "capture_checkpoint", checkpoint: "hero" },
    ],
  }), (error) => error instanceof CaptureRecipeError && error.code === "capture_selector_required");
});

test("capture navigation cannot leave the approved origin", () => {
  const recipe = activeRecipe();
  assert.equal(resolveRecipeNavigation(recipe, "/safe"), "https://preview.example.test/safe");
  assert.throws(() => resolveRecipeNavigation(recipe, "https://evil.example/steal"), (error) => error.code === "origin_changed");
});

test("runtime validation enforces environment capabilities and safe fixtures", () => {
  const recipe = activeRecipe({
    steps: [
      { stepId: "fill", action: "fill_safe_fixture", selector: "#title", fixtureKey: "demo-title" },
      { stepId: "capture", action: "capture_checkpoint", checkpoint: "hero" },
    ],
  });
  assert.equal(validateCaptureRuntime({ recipe, environment: "demo", availableCapabilities: ["screenshot"], fixtureKeys: ["demo-title"] }), true);
  assert.throws(() => validateCaptureRuntime({ recipe, environment: "preview", availableCapabilities: ["screenshot"], fixtureKeys: ["demo-title"] }), (error) => error.code === "unauthorized_target");
  assert.throws(() => validateCaptureRuntime({ recipe, environment: "demo", availableCapabilities: [], fixtureKeys: ["demo-title"] }), (error) => error.code === "capture_capability_missing");
  assert.throws(() => validateCaptureRuntime({ recipe, environment: "demo", availableCapabilities: ["screenshot"], fixtureKeys: [] }), (error) => error.code === "fixture_unavailable");
});

test("expected checkpoints must be produced by the recipe", () => {
  assert.throws(() => draftRecipe({
    steps: [{ stepId: "open", action: "navigate", path: "/demo" }],
    expectedCheckpoints: ["hero"],
  }), (error) => error.code === "capture_checkpoint_not_declared");
});

test("recipe edits create a new immutable version", async () => {
  const repository = createMemoryCaptureRepository();
  const v1 = activeRecipe();
  await repository.upsertRecipe(v1);
  const v2 = reviseCaptureRecipe(v1, {
    name: "Updated capture",
    steps: [
      { stepId: "open-demo", action: "navigate", path: "/demo" },
      { stepId: "capture-hero", action: "capture_checkpoint", checkpoint: "hero" },
    ],
  }, "2026-08-23T00:01:00.000Z");
  assert.equal(v2.version, 2);
  await repository.upsertRecipe(v2);
  assert.equal((await repository.getRecipe("recipe-1", 1)).name, "Product hero capture");
  assert.equal((await repository.getRecipe("recipe-1", 2)).name, "Updated capture");
  await assert.rejects(() => repository.upsertRecipe({ ...v1, name: "Mutated v1" }), (error) => error.code === "capture_recipe_version_mutation_forbidden");
});

test("capture jobs bind the exact active recipe version into the durable job", () => {
  const recipe = activeRecipe();
  const { captureJob, durableJob } = createCaptureJob({
    captureJobId: "capture-job-1",
    jobId: "job-1",
    recipe,
    captureKind: "screenshot",
    requestedCheckpoint: "hero",
    idempotencyKey: "capture-job-1-recipe-v1",
    createdAt: "2026-08-23T00:00:02.000Z",
  });
  assert.equal(captureJob.captureRecipeVersion, 1);
  assert.equal(durableJob.inputVersion, 1);
  assert.equal(durableJob.inputRef, "recipe-1");
  assert.equal(durableJob.resourceId, "capture-job-1");
});

test("inactive recipes cannot be queued for execution", () => {
  assert.throws(() => createCaptureJob({
    captureJobId: "capture-job-1",
    jobId: "job-1",
    recipe: draftRecipe(),
    idempotencyKey: "capture-job-1-recipe-v1",
    createdAt: T0,
  }), (error) => error.code === "capture_recipe_not_active");
});

test("capture recipe keeps secret references but never secret values", () => {
  const recipe = draftRecipe({ secretReferenceIds: ["secret-ref-session"] });
  assert.deepEqual(recipe.secretReferenceIds, ["secret-ref-session"]);
  assert.equal(Object.prototype.hasOwnProperty.call(recipe, "secretValues"), false);
  assert.equal(JSON.stringify(recipe).includes("super-secret-value"), false);
});

test("bounded screenshot execution persists a canonical capture Asset and completes the durable job", async () => {
  const recipe = activeRecipe();
  const captureRepository = createMemoryCaptureRepository({ recipes: [recipe] });
  const durableJobs = createMemoryDurableJobPort();
  const assetRepository = createMemoryAssetRepository();
  const blobStorage = createMemoryBlobStorage();
  const ids = createDeterministicIdService("capture-test");
  const time = clock();
  const pair = createCaptureJob({
    captureJobId: "capture-job-1",
    jobId: "job-1",
    recipe,
    captureKind: "screenshot",
    requestedCheckpoint: "hero",
    idempotencyKey: "capture-job-1-recipe-v1",
    createdAt: time.now(),
  });
  await captureRepository.upsertJob(pair.captureJob);
  await enqueueDurableJob(durableJobs, pair.durableJob);

  const application = createCaptureExecutionApplication({
    durableJobRepository: durableJobs,
    captureRepository,
    captureWorkerAdapter: createDeterministicCaptureWorkerAdapter({ visibleSelectors: ["#app"] }),
    assetRepository,
    blobStorage,
    clock: time,
    idService: ids,
    environment: "demo",
    leaseOwner: "worker-test",
  });

  const result = await application.runNext();
  assert.equal(result.durableJob.status, JOB_STATUSES.SUCCEEDED);
  assert.equal(result.captureJob.status, "succeeded");
  assert.equal(result.assets.length, 1);
  assert.equal(result.assets[0].assetType, "image");
  assert.equal(result.assets[0].lifecycle, "original");
  assert.equal(result.assets[0].privacy.classification, "workspace_private");
  assert.equal(result.assets[0].provenance[0].eventType, "automatic_capture");
  assert.deepEqual(result.durableJob.outputRefs, [result.assets[0].assetId]);
  assert.ok(await blobStorage.get(result.assets[0].blobId));
});

test("privacy rules fail closed before screenshot output is persisted", async () => {
  const recipe = activeRecipe();
  const captureRepository = createMemoryCaptureRepository({ recipes: [recipe] });
  const durableJobs = createMemoryDurableJobPort();
  const assetRepository = createMemoryAssetRepository();
  const time = clock();
  const pair = createCaptureJob({
    captureJobId: "capture-job-private",
    jobId: "job-private",
    recipe,
    captureKind: "screenshot",
    requestedCheckpoint: "hero",
    idempotencyKey: "capture-job-private-v1",
    createdAt: time.now(),
  });
  await captureRepository.upsertJob(pair.captureJob);
  await enqueueDurableJob(durableJobs, pair.durableJob);
  const application = createCaptureExecutionApplication({
    durableJobRepository: durableJobs,
    captureRepository,
    captureWorkerAdapter: createDeterministicCaptureWorkerAdapter({
      visibleSelectors: ["#app"],
      blockedPrivacyCodes: ["hide-personal-email"],
    }),
    assetRepository,
    blobStorage: createMemoryBlobStorage(),
    clock: time,
    idService: createDeterministicIdService("private-test"),
    environment: "demo",
    leaseOwner: "worker-private",
  });
  await assert.rejects(() => application.runNext(), (error) => error.code === "privacy_rule_triggered");
  assert.equal((await durableJobs.get("job-private")).status, JOB_STATUSES.FAILED);
  assert.equal((await captureRepository.getJob("capture-job-private")).status, "failed");
  assert.equal((await assetRepository.list()).length, 0);
});
