import test from "node:test";
import assert from "node:assert/strict";

import {
  createProjectCaptureRecipeProvisioningApplication,
  createProvisioningCaptureRepository,
} from "../lib/application/projectCaptureRecipeProvisioningApplication.mjs";
import {
  activateCaptureRecipe,
  createCaptureRecipe,
} from "../lib/domain/captureRecipes.mjs";
import { createMemoryCaptureRepository } from "../lib/infrastructure/productExecutionMemoryAdapters.mjs";

const NOW = "2026-09-16T16:45:00.000Z";
const WORKSPACE = "owner-local";
const PROJECT = "sf-project-github-1269263906";
const TARGET = "https://signal-flow-studio.vercel.app";
const clock = { now: () => NOW };

function provisioning(repository) {
  return createProjectCaptureRecipeProvisioningApplication({
    workspaceId: WORKSPACE,
    captureRepository: repository,
    targetOrigin: TARGET,
    allowedEnvironment: "preview",
    clock,
  });
}

function customRecipe(id = "custom-project-proof") {
  return activateCaptureRecipe(createCaptureRecipe({
    captureRecipeId: id,
    workspaceId: WORKSPACE,
    projectId: PROJECT,
    name: "Custom project proof",
    targetOrigin: TARGET,
    allowedEnvironment: "preview",
    requiredCapabilities: ["screenshot"],
    fixturePolicy: { allowedKeys: [], realUserDataAllowed: false },
    privacyRules: [],
    expectedCheckpoints: ["custom-proof"],
    steps: [
      { stepId: "open-proof", action: "navigate", path: "/capture-preview/workspace-loading" },
      { stepId: "capture-proof", action: "capture_checkpoint", checkpoint: "custom-proof" },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  }), NOW);
}

function staleCanonicalRecipe() {
  return activateCaptureRecipe(createCaptureRecipe({
    captureRecipeId: `gp2-workspace-loading-${PROJECT}`,
    workspaceId: WORKSPACE,
    projectId: PROJECT,
    name: "SignalFlow workspace loading proof",
    targetOrigin: TARGET,
    allowedEnvironment: "preview",
    requiredCapabilities: ["screenshot"],
    fixturePolicy: { allowedKeys: [], realUserDataAllowed: false },
    privacyRules: [],
    expectedCheckpoints: ["workspace-loading"],
    steps: [
      { stepId: "open-workspace-loading-preview", action: "navigate", path: "/capture-preview/workspace-loading" },
      { stepId: "wait-for-workspace-loading", action: "wait_for", selector: "main" },
      {
        stepId: "capture-workspace-loading",
        action: "capture_checkpoint",
        checkpoint: "workspace-loading",
        qualitySelectors: { error: [], loading: [], requiredSubject: ["main"] },
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  }), NOW);
}

test("zero project recipes self-provision exactly one active safe workspace-loading recipe", async () => {
  const base = createMemoryCaptureRepository();
  const repository = createProvisioningCaptureRepository({
    captureRepository: base,
    provisioningApplication: provisioning(base),
  });

  const first = await repository.listRecipes({ projectId: PROJECT });
  const second = await repository.listRecipes({ projectId: PROJECT });

  assert.equal(first.length, 1);
  assert.equal(second.length, 1);
  const [recipe] = first;
  assert.equal(recipe.status, "active");
  assert.equal(recipe.workspaceId, WORKSPACE);
  assert.equal(recipe.projectId, PROJECT);
  assert.equal(recipe.targetOrigin, TARGET);
  assert.equal(recipe.allowedEnvironment, "preview");
  assert.deepEqual(recipe.expectedCheckpoints, ["workspace-loading"]);
  assert.equal(recipe.fixturePolicy.realUserDataAllowed, false);
  assert.equal(recipe.secretReferenceIds.length, 0);
  assert.deepEqual(recipe.requiredCapabilities, ["screenshot"]);
  assert.equal(recipe.steps[0].action, "navigate");
  assert.equal(recipe.steps[0].path, "/capture-preview/workspace-loading");
  const captureStep = recipe.steps.at(-1);
  assert.equal(captureStep.action, "capture_checkpoint");
  assert.equal(captureStep.checkpoint, "workspace-loading");
  assert.deepEqual(captureStep.qualitySelectors.error, ["[data-signalflow-capture-error]"]);
  assert.deepEqual(captureStep.qualitySelectors.loading, ["[data-signalflow-capture-unexpected-loading]"]);
  assert.deepEqual(captureStep.qualitySelectors.requiredSubject, ["[data-signalflow-capture-subject='workspace-loading']"]);
  assert.ok(recipe.privacyRules.some((rule) => rule.code === "private-marker-visible" && rule.severity === "block"));
});

test("stale canonical v1 recipe is revised immutably instead of rewritten in place", async () => {
  const old = staleCanonicalRecipe();
  const base = createMemoryCaptureRepository({ recipes: [old] });
  const result = await provisioning(base).ensureProjectRecipe(PROJECT);
  const stored = await base.listRecipes({ projectId: PROJECT });

  assert.equal(result.revised, true);
  assert.equal(result.recipe.version, 2);
  assert.equal(result.recipe.captureRecipeId, old.captureRecipeId);
  assert.equal(stored.length, 2);
  const versions = stored.map((item) => item.version).sort((a, b) => a - b);
  assert.deepEqual(versions, [1, 2]);
  assert.deepEqual(result.recipe.steps.at(-1).qualitySelectors.error, ["[data-signalflow-capture-error]"]);
});

test("an existing custom active project recipe is reused without manufacturing a second active recipe", async () => {
  const custom = customRecipe();
  const base = createMemoryCaptureRepository({ recipes: [custom] });
  const application = provisioning(base);

  const result = await application.ensureProjectRecipe(PROJECT);
  const stored = await base.listRecipes({ projectId: PROJECT });

  assert.equal(result.reused, true);
  assert.equal(result.provisioned, false);
  assert.equal(result.recipe.captureRecipeId, custom.captureRecipeId);
  assert.equal(stored.length, 1);
});

test("multiple active project recipes fail closed instead of silently choosing a browser action plan", async () => {
  const base = createMemoryCaptureRepository({
    recipes: [customRecipe("custom-proof-one"), customRecipe("custom-proof-two")],
  });
  const application = provisioning(base);

  await assert.rejects(
    () => application.ensureProjectRecipe(PROJECT),
    (error) => error?.code === "capture_recipe_ambiguous" && error?.status === 409,
  );
});

test("capture target origin rejects insecure and credential-bearing URLs", () => {
  for (const targetOrigin of [
    "http://signal-flow-studio.vercel.app",
    "https://user:password@signal-flow-studio.vercel.app",
    "not-a-url",
  ]) {
    assert.throws(
      () => createProjectCaptureRecipeProvisioningApplication({
        workspaceId: WORKSPACE,
        captureRepository: createMemoryCaptureRepository(),
        targetOrigin,
        allowedEnvironment: "preview",
        clock,
      }),
      /Capture target origin/,
    );
  }
});
