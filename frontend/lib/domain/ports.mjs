export const PORT_CONTRACTS = Object.freeze({
  campaignRepository: ["list", "get", "upsert", "remove"],
  contentSignalRepository: ["list", "get", "upsert", "remove", "findByExternalEvent", "insertExternalIfAbsent"],
  sourceConnectionRepository: ["list", "get", "upsert", "remove", "findByProviderInstallation"],
  contentOpportunityRepository: ["list", "get", "upsert", "remove"],
  projectContextRepository: ["list", "get", "upsert", "remove"],
  contentPlanningRepository: ["list", "get", "upsert", "remove"],
  contentReviewRepository: ["list", "get", "upsert", "remove"],
  narrativeMemoryRepository: ["list", "get", "upsert", "remove"],
  styleMemoryRepository: ["list", "get", "upsert", "remove"],
  identityRepository: ["list", "get", "upsert", "remove"],
  mediaIntelligenceRepository: ["list", "get", "upsert", "remove", "listByScope", "listByContentPiece"],
  durableJobRepository: ["list", "get", "upsert", "remove", "findByIdempotency", "claimNext"],
  captureRepository: ["listRecipes", "getRecipe", "upsertRecipe", "listJobs", "getJob", "upsertJob"],
  assetRepository: ["list", "get", "upsert", "remove"],
  sourceArtifactRepository: ["list", "get", "upsert", "remove"],
  assetProcessingRepository: ["list", "get", "upsert", "remove"],
  approvalRepository: ["list", "get", "upsert", "remove"],
  exportRepository: ["list", "get", "upsert", "remove"],
  blobStorage: ["put", "get", "remove"],
  transferReportRepository: ["list", "get", "upsert", "remove"],
  archiveSigner: ["sign", "verify", "describe"],
  jobQueue: ["enqueue", "get", "cancel"],
  providerAdapter: ["test", "generate"],
  inferenceAdapter: ["execute"],
  connectorAdapter: ["status", "publish"],
  captureWorkerAdapter: ["describe", "open", "navigate", "waitFor", "click", "focus", "fillSafeFixture", "select", "scroll", "pause", "assertVisible", "captureCheckpoint", "startRecording", "stopRecording", "evaluatePrivacy", "close"],
  notificationAdapter: ["send"],
  clock: ["now"],
  idService: ["create"],
});

export function assertPort(name, adapter) {
  const methods = PORT_CONTRACTS[name];
  if (!methods) throw new TypeError(`Unknown application port: ${name}.`);
  if (!adapter || typeof adapter !== "object") {
    throw new TypeError(`${name} adapter is required.`);
  }
  for (const method of methods) {
    if (typeof adapter[method] !== "function") {
      throw new TypeError(`${name}.${method} must be a function.`);
    }
  }
  return adapter;
}

export function createSystemClock() {
  return {
    now() {
      return new Date().toISOString();
    },
  };
}

export function createSystemIdService(prefix = "sf") {
  return {
    create(kind = "record") {
      const normalizedKind = String(kind || "record").toLowerCase();
      const randomId = globalThis.crypto?.randomUUID?.()
        || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
      return `${prefix}-${normalizedKind}-${randomId}`;
    },
  };
}

export function createDeterministicIdService(prefix = "sf") {
  let sequence = 0;
  return {
    create(kind = "record") {
      sequence += 1;
      return `${prefix}-${String(kind).toLowerCase()}-${sequence}`;
    },
  };
}
