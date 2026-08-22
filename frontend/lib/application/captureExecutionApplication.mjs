import { assertPort } from "../domain/ports.mjs";
import {
  CAPTURE_ACTIONS,
  CAPTURE_JOB_STATUSES,
  CaptureRecipeError,
  normalizeCaptureJob,
  resolveRecipeNavigation,
  validateCaptureRuntime,
} from "../domain/captureRecipes.mjs";
import {
  JOB_STATUSES,
  JOB_TYPES,
  acknowledgeDurableJobCancellation,
  failDurableJob,
  heartbeatDurableJob,
  succeedDurableJob,
} from "../domain/durableJobs.mjs";
import {
  INGESTION_METHODS,
  PRIVACY_CLASSES,
  UPLOAD_STATES,
  normalizeAsset,
} from "../domain/sourceArtifacts.mjs";

function safeCode(value, fallback = "capture_failed") {
  const normalized = String(value || fallback).trim().toLowerCase();
  return /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(normalized) ? normalized : fallback;
}

function safeFailure(error) {
  const code = safeCode(error?.code);
  const retryableCodes = new Set(["navigation_timeout", "browser_crash", "capture_failed", "storage_failed", "worker_unavailable"]);
  return {
    code,
    retryable: retryableCodes.has(code),
    externalOutcomeUnknown: false,
    message: code.replaceAll("_", " "),
  };
}

function stageForAction(action) {
  if (action === CAPTURE_ACTIONS.NAVIGATE) return CAPTURE_JOB_STATUSES.NAVIGATING;
  if ([CAPTURE_ACTIONS.WAIT_FOR, CAPTURE_ACTIONS.ASSERT_VISIBLE].includes(action)) return CAPTURE_JOB_STATUSES.WAITING_FOR_CHECKPOINT;
  if ([CAPTURE_ACTIONS.CAPTURE_CHECKPOINT, CAPTURE_ACTIONS.START_RECORDING, CAPTURE_ACTIONS.STOP_RECORDING].includes(action)) return CAPTURE_JOB_STATUSES.CAPTURING;
  return CAPTURE_JOB_STATUSES.NAVIGATING;
}

function actionMethod(action) {
  return {
    [CAPTURE_ACTIONS.WAIT_FOR]: "waitFor",
    [CAPTURE_ACTIONS.CLICK]: "click",
    [CAPTURE_ACTIONS.FOCUS]: "focus",
    [CAPTURE_ACTIONS.FILL_SAFE_FIXTURE]: "fillSafeFixture",
    [CAPTURE_ACTIONS.SELECT]: "select",
    [CAPTURE_ACTIONS.SCROLL]: "scroll",
    [CAPTURE_ACTIONS.PAUSE_FOR_CAPTURE]: "pause",
    [CAPTURE_ACTIONS.ASSERT_VISIBLE]: "assertVisible",
    [CAPTURE_ACTIONS.CAPTURE_CHECKPOINT]: "captureCheckpoint",
    [CAPTURE_ACTIONS.START_RECORDING]: "startRecording",
    [CAPTURE_ACTIONS.STOP_RECORDING]: "stopRecording",
  }[action] || null;
}

export function createCaptureExecutionApplication({
  durableJobRepository,
  captureRepository,
  captureWorkerAdapter,
  assetRepository,
  blobStorage,
  clock,
  idService,
  environment = "demo",
  fixtureValues = {},
  leaseOwner = "capture-worker",
  leaseSeconds = 90,
} = {}) {
  const jobs = assertPort("durableJobRepository", durableJobRepository);
  const captures = assertPort("captureRepository", captureRepository);
  const worker = assertPort("captureWorkerAdapter", captureWorkerAdapter);
  const assets = assertPort("assetRepository", assetRepository);
  const blobs = assertPort("blobStorage", blobStorage);
  const time = assertPort("clock", clock);
  const ids = assertPort("idService", idService);

  async function updateCaptureStatus(captureJob, status, { issueCode = null, outputAssetIds = null, completedAt = null } = {}) {
    const now = time.now();
    return captures.upsertJob(normalizeCaptureJob({
      ...captureJob,
      status,
      issueCode,
      outputAssetIds: outputAssetIds || captureJob.outputAssetIds,
      completedAt,
      updatedAt: now,
    }));
  }

  async function heartbeat(job, stage, message = null) {
    const now = time.now();
    const fresh = await jobs.get(job.jobId);
    if (fresh?.cancellationRequestedAt) {
      const cancelled = acknowledgeDurableJobCancellation(fresh, { leaseOwner, now });
      await jobs.upsert(cancelled);
      const error = new Error("Capture was cancelled.");
      error.code = "cancelled";
      throw error;
    }
    const next = heartbeatDurableJob(job, {
      leaseOwner,
      leaseSeconds,
      progress: { stage, message },
      now,
    });
    return jobs.upsert(next);
  }

  async function persistCaptureOutput({ recipe, captureJob, output, checkpoint = null, sequence = 0 }) {
    if (!output || output.payload === undefined || output.payload === null) {
      const error = new Error("Capture adapter returned no output payload.");
      error.code = "capture_failed";
      throw error;
    }
    const blobId = ids.create("capture-blob");
    try {
      await blobs.put(blobId, output.payload);
    } catch {
      const error = new Error("Capture output storage failed.");
      error.code = "storage_failed";
      throw error;
    }
    const now = time.now();
    const assetId = ids.create("capture-asset");
    const asset = normalizeAsset({
      assetId,
      assetVersionId: ids.create("capture-asset-version"),
      workspaceId: recipe.workspaceId,
      projectId: recipe.projectId,
      lifecycle: "original",
      originalName: output.originalName || `${captureJob.captureKind}-${checkpoint || sequence}.${captureJob.captureKind === "screenshot" ? "png" : "webm"}`,
      mimeType: output.mimeType || (captureJob.captureKind === "screenshot" ? "image/png" : "video/webm"),
      byteSize: Number(output.byteSize || 0),
      dimensions: output.dimensions || null,
      durationMs: output.durationMs || null,
      contentHash: output.contentHash || null,
      storageRef: { provider: "application", blobId },
      uploadState: UPLOAD_STATES.COMPLETE,
      privacy: {
        classification: output.privacyClass || PRIVACY_CLASSES.WORKSPACE_PRIVATE,
        exportAllowed: output.exportAllowed !== false,
        processingAllowed: output.processingAllowed !== false,
      },
      userMetadata: {
        description: `Automatic ${captureJob.captureKind} from ${recipe.name}${checkpoint ? ` at ${checkpoint}` : ""}.`,
        tags: ["automatic-capture", captureJob.captureKind, checkpoint].filter(Boolean),
        intendedUse: ["capture_output"],
      },
      ingestionMethod: INGESTION_METHODS.API,
      provenance: [{
        eventType: "automatic_capture",
        method: INGESTION_METHODS.API,
        occurredAt: now,
        actorType: "worker",
        actorId: null,
        parentSourceArtifactIds: [],
        parentAssetIds: [],
        processor: {
          name: "signalflow-capture-worker",
          version: String(recipe.captureSchemaVersion || 1),
          model: `${recipe.captureRecipeId}@${recipe.version}:${captureJob.captureJobId}`,
        },
        issueCodes: [],
      }],
      createdAt: now,
      updatedAt: now,
    }, { workspaceId: recipe.workspaceId, projectId: recipe.projectId, now });
    return assets.upsert(asset);
  }

  async function executeClaimedJob(job) {
    let durableJob = job;
    const captureJob = await captures.getJob(job.resourceId);
    if (!captureJob || captureJob.jobId !== job.jobId) {
      const error = new Error("Capture job record is missing or does not match its durable job.");
      error.code = "capture_job_missing";
      throw error;
    }
    const recipe = await captures.getRecipe(captureJob.captureRecipeId, captureJob.captureRecipeVersion);
    if (!recipe || recipe.version !== job.inputVersion) {
      const error = new Error("Capture recipe version no longer matches the queued durable input.");
      error.code = "stale_input_version";
      throw error;
    }
    const description = await worker.describe();
    if (!description?.available) {
      const error = new Error("Configured capture worker is unavailable.");
      error.code = "worker_unavailable";
      throw error;
    }
    validateCaptureRuntime({
      recipe,
      environment,
      availableCapabilities: description.capabilities || [],
      fixtureKeys: Object.keys(fixtureValues),
    });

    let currentCaptureJob = await updateCaptureStatus(captureJob, CAPTURE_JOB_STATUSES.PREPARING_ENVIRONMENT);
    durableJob = await heartbeat(durableJob, "preparing_environment");
    const session = await worker.open({
      targetOrigin: recipe.targetOrigin,
      environment,
      secretReferenceIds: recipe.secretReferenceIds,
      maxDurationSeconds: recipe.maxDurationSeconds,
    });
    currentCaptureJob = await updateCaptureStatus(currentCaptureJob, CAPTURE_JOB_STATUSES.LAUNCHING_BROWSER);
    durableJob = await heartbeat(durableJob, "launching_browser");

    const outputAssets = [];
    try {
      let sequence = 0;
      for (const step of recipe.steps) {
        durableJob = await heartbeat(durableJob, stageForAction(step.action), step.stepId);
        currentCaptureJob = await updateCaptureStatus(currentCaptureJob, stageForAction(step.action));
        let output = null;
        if (step.action === CAPTURE_ACTIONS.NAVIGATE) {
          const target = resolveRecipeNavigation(recipe, step.path);
          await worker.navigate(session, target);
        } else {
          const method = actionMethod(step.action);
          if (!method) throw new CaptureRecipeError("recipe_step_invalid", `Unsupported capture action ${step.action}.`);
          if ([CAPTURE_ACTIONS.CAPTURE_CHECKPOINT, CAPTURE_ACTIONS.START_RECORDING].includes(step.action)) {
            const privacy = await worker.evaluatePrivacy(session, recipe.privacyRules);
            if (privacy?.blocked) throw new CaptureRecipeError("privacy_rule_triggered", "Capture privacy policy blocked this checkpoint.", { issueCodes: privacy.issueCodes || [] });
          }
          const args = step.action === CAPTURE_ACTIONS.FILL_SAFE_FIXTURE
            ? { ...step, value: fixtureValues[step.fixtureKey] }
            : step;
          output = await worker[method](session, args);
        }
        const shouldPersist = output && (
          step.action === CAPTURE_ACTIONS.CAPTURE_CHECKPOINT
          || step.action === CAPTURE_ACTIONS.STOP_RECORDING
        );
        if (shouldPersist && (!captureJob.requestedCheckpoint || step.checkpoint === captureJob.requestedCheckpoint || step.action === CAPTURE_ACTIONS.STOP_RECORDING)) {
          sequence += 1;
          outputAssets.push(await persistCaptureOutput({ recipe, captureJob, output, checkpoint: step.checkpoint, sequence }));
        }
      }
      if (!outputAssets.length) {
        const error = new Error("Capture recipe finished without producing the requested output.");
        error.code = "capture_failed";
        throw error;
      }
      currentCaptureJob = await updateCaptureStatus(currentCaptureJob, CAPTURE_JOB_STATUSES.PROCESSING_OUTPUT, { outputAssetIds: outputAssets.map((asset) => asset.assetId) });
      durableJob = await heartbeat(durableJob, "processing_output");
      const completedAt = time.now();
      currentCaptureJob = await updateCaptureStatus(currentCaptureJob, CAPTURE_JOB_STATUSES.SUCCEEDED, {
        outputAssetIds: outputAssets.map((asset) => asset.assetId),
        completedAt,
      });
      durableJob = succeedDurableJob(durableJob, { leaseOwner, outputRefs: outputAssets.map((asset) => asset.assetId), now: completedAt });
      durableJob = await jobs.upsert(durableJob);
      return { durableJob, captureJob: currentCaptureJob, assets: outputAssets };
    } finally {
      await worker.close(session).catch(() => {});
    }
  }

  async function runNext() {
    const claimed = await jobs.claimNext({
      leaseOwner,
      leaseSeconds,
      now: time.now(),
      jobTypes: [JOB_TYPES.CAPTURE_SCREENSHOT, JOB_TYPES.CAPTURE_SCREENCAST],
    });
    if (!claimed) return null;
    try {
      return await executeClaimedJob(claimed);
    } catch (error) {
      const now = time.now();
      const freshJob = await jobs.get(claimed.jobId);
      const captureJob = await captures.getJob(claimed.resourceId);
      if (error?.code === "cancelled" || freshJob?.status === JOB_STATUSES.CANCELLED) {
        if (captureJob) await updateCaptureStatus(captureJob, CAPTURE_JOB_STATUSES.CANCELLED, { issueCode: "cancelled", completedAt: now });
        return { durableJob: freshJob, captureJob: captureJob ? await captures.getJob(captureJob.captureJobId) : null, assets: [] };
      }
      if (freshJob && [JOB_STATUSES.RUNNING, JOB_STATUSES.CANCEL_REQUESTED].includes(freshJob.status)) {
        const failed = failDurableJob(freshJob, { leaseOwner, error: safeFailure(error), now });
        await jobs.upsert(failed);
      }
      if (captureJob) await updateCaptureStatus(captureJob, CAPTURE_JOB_STATUSES.FAILED, { issueCode: safeCode(error?.code), completedAt: now });
      throw error;
    }
  }

  return { runNext, executeClaimedJob };
}
