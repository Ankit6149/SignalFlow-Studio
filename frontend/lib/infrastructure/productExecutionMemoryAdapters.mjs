import { assertPort } from "../domain/ports.mjs";
import { portableClone } from "../domain/contracts.mjs";
import {
  JOB_STATUSES,
  claimDurableJob,
  normalizeDurableJob,
} from "../domain/durableJobs.mjs";
import {
  normalizeAssetLineage,
  normalizeAssetRoleBinding,
  normalizeMediaDecision,
  normalizeMediaIntentResolution,
  normalizeMediaRequirement,
} from "../domain/mediaIntelligence.mjs";
import {
  normalizeImageDerivativePlan,
  normalizeScreenshotQualityReview,
} from "../domain/screenshotProduction.mjs";
import { normalizeCaptureJob, normalizeCaptureRecipe } from "../domain/captureRecipes.mjs";

function clone(value) {
  return portableClone(value);
}

function mediaRecordId(record) {
  if (record.kind === "MediaIntentResolution") return record.mediaIntentResolutionId;
  if (record.kind === "AssetRoleBinding") return record.assetRoleBindingId;
  if (record.kind === "AssetLineage") return record.assetLineageId;
  if (record.kind === "MediaDecision") return record.mediaDecisionId;
  if (record.kind === "MediaRequirement") return record.mediaRequirementId;
  if (record.kind === "ScreenshotQualityReview") return record.screenshotQualityReviewId;
  if (record.kind === "ImageDerivativePlan") return record.imageDerivativePlanId;
  throw new TypeError(`Unsupported media record ${record.kind || "missing"}.`);
}

function normalizeMedia(input) {
  if (input?.kind === "MediaIntentResolution") return normalizeMediaIntentResolution(input);
  if (input?.kind === "AssetRoleBinding") return normalizeAssetRoleBinding(input);
  if (input?.kind === "AssetLineage") return normalizeAssetLineage(input);
  if (input?.kind === "MediaDecision") return normalizeMediaDecision(input);
  if (input?.kind === "MediaRequirement") return normalizeMediaRequirement(input);
  if (input?.kind === "ScreenshotQualityReview") return normalizeScreenshotQualityReview(input);
  if (input?.kind === "ImageDerivativePlan") return normalizeImageDerivativePlan(input);
  throw new TypeError(`Unsupported media record ${input?.kind || "missing"}.`);
}

export function createMemoryMediaIntelligenceRepository(initial = []) {
  const records = new Map();
  for (const input of initial) {
    const record = normalizeMedia(input);
    records.set(mediaRecordId(record), record);
  }
  return assertPort("mediaIntelligenceRepository", {
    async list() { return [...records.values()].map(clone); },
    async get(id) { return records.has(id) ? clone(records.get(id)) : null; },
    async upsert(input) {
      const record = normalizeMedia(input);
      records.set(mediaRecordId(record), record);
      return clone(record);
    },
    async remove(id) { return records.delete(id); },
    async listByScope(scopeType, scopeId) {
      return [...records.values()].filter((record) => record.scopeType === scopeType && record.scopeId === scopeId).map(clone);
    },
    async listByContentPiece(contentPieceId) {
      return [...records.values()].filter((record) => record.contentPieceId === contentPieceId || (record.scopeType === "content_piece" && record.scopeId === contentPieceId)).map(clone);
    },
  });
}

export function createMemoryDurableJobPort(initial = []) {
  const records = new Map();
  for (const input of initial) {
    const job = normalizeDurableJob(input);
    records.set(job.jobId, job);
  }
  return assertPort("durableJobRepository", {
    async list() { return [...records.values()].map(clone); },
    async get(id) { return records.has(id) ? clone(records.get(id)) : null; },
    async upsert(input) {
      const job = normalizeDurableJob(input);
      records.set(job.jobId, job);
      return clone(job);
    },
    async remove(id) { return records.delete(id); },
    async findByIdempotency(workspaceId, jobType, idempotencyKey) {
      const job = [...records.values()].find((item) => item.workspaceId === workspaceId && item.jobType === jobType && item.idempotencyKey === idempotencyKey);
      return job ? clone(job) : null;
    },
    async claimById(jobId, { leaseOwner, leaseSeconds = 60, now, jobTypes = [] } = {}) {
      const job = records.get(jobId);
      if (!job) return null;
      const allowed = new Set(jobTypes);
      if (allowed.size && !allowed.has(job.jobType)) return null;
      if (![JOB_STATUSES.QUEUED, JOB_STATUSES.SCHEDULED, JOB_STATUSES.RETRYING].includes(job.status)) return null;
      if (job.cancellationRequestedAt) return null;
      if (job.nextAttemptAt && Date.parse(job.nextAttemptAt) > Date.parse(now)) return null;
      if (job.scheduledAt && Date.parse(job.scheduledAt) > Date.parse(now)) return null;
      const claimed = claimDurableJob(job, { leaseOwner, leaseSeconds, now });
      records.set(claimed.jobId, claimed);
      return clone(claimed);
    },
    async claimNext({ leaseOwner, leaseSeconds = 60, now, jobTypes = [] } = {}) {
      const allowed = new Set(jobTypes);
      const due = [...records.values()]
        .filter((job) => [JOB_STATUSES.QUEUED, JOB_STATUSES.SCHEDULED, JOB_STATUSES.RETRYING].includes(job.status))
        .filter((job) => !allowed.size || allowed.has(job.jobType))
        .filter((job) => !job.cancellationRequestedAt)
        .filter((job) => !job.nextAttemptAt || Date.parse(job.nextAttemptAt) <= Date.parse(now))
        .filter((job) => !job.scheduledAt || Date.parse(job.scheduledAt) <= Date.parse(now))
        .sort((left, right) => right.priority - left.priority || String(left.createdAt).localeCompare(String(right.createdAt)));
      if (!due.length) return null;
      const claimed = claimDurableJob(due[0], { leaseOwner, leaseSeconds, now });
      records.set(claimed.jobId, claimed);
      return clone(claimed);
    },
  });
}

export function createMemoryCaptureRepository({ recipes = [], jobs = [] } = {}) {
  const recipeRecords = new Map();
  const jobRecords = new Map();
  const recipeKey = (id, version) => `${id}@${version}`;
  for (const input of recipes) {
    const recipe = normalizeCaptureRecipe(input);
    recipeRecords.set(recipeKey(recipe.captureRecipeId, recipe.version), recipe);
  }
  for (const input of jobs) {
    const job = normalizeCaptureJob(input);
    jobRecords.set(job.captureJobId, job);
  }
  return assertPort("captureRepository", {
    async listRecipes({ projectId = null, captureRecipeId = null } = {}) {
      return [...recipeRecords.values()]
        .filter((recipe) => !projectId || recipe.projectId === projectId)
        .filter((recipe) => !captureRecipeId || recipe.captureRecipeId === captureRecipeId)
        .sort((left, right) => right.version - left.version)
        .map(clone);
    },
    async getRecipe(captureRecipeId, version = null) {
      if (Number.isInteger(version)) {
        const recipe = recipeRecords.get(recipeKey(captureRecipeId, version));
        return recipe ? clone(recipe) : null;
      }
      const versions = [...recipeRecords.values()].filter((recipe) => recipe.captureRecipeId === captureRecipeId).sort((left, right) => right.version - left.version);
      return versions[0] ? clone(versions[0]) : null;
    },
    async upsertRecipe(input) {
      const recipe = normalizeCaptureRecipe(input);
      const key = recipeKey(recipe.captureRecipeId, recipe.version);
      const existing = recipeRecords.get(key);
      if (existing) {
        const comparableExisting = clone(existing);
        const comparableNext = clone(recipe);
        delete comparableExisting.status;
        delete comparableExisting.updatedAt;
        delete comparableNext.status;
        delete comparableNext.updatedAt;
        if (JSON.stringify(comparableExisting) !== JSON.stringify(comparableNext)) {
          const error = new Error("Capture recipe versions are immutable except for lifecycle status.");
          error.code = "capture_recipe_version_mutation_forbidden";
          throw error;
        }
      }
      recipeRecords.set(key, recipe);
      return clone(recipe);
    },
    async listJobs({ captureRecipeId = null } = {}) {
      return [...jobRecords.values()].filter((job) => !captureRecipeId || job.captureRecipeId === captureRecipeId).map(clone);
    },
    async getJob(id) { return jobRecords.has(id) ? clone(jobRecords.get(id)) : null; },
    async upsertJob(input) {
      const job = normalizeCaptureJob(input);
      const existing = jobRecords.get(job.captureJobId);
      if (existing && (existing.captureRecipeId !== job.captureRecipeId || existing.captureRecipeVersion !== job.captureRecipeVersion || existing.jobId !== job.jobId)) {
        const error = new Error("Capture job identity cannot be rebound after creation.");
        error.code = "capture_job_identity_mutation_forbidden";
        throw error;
      }
      jobRecords.set(job.captureJobId, job);
      return clone(job);
    },
  });
}
