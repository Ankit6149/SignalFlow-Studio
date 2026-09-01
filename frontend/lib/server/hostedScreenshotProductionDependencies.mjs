import { createCaptureExecutionApplication } from "../application/captureExecutionApplication.mjs";
import { createExactCaptureJobExecutionApplication } from "../application/exactCaptureJobExecutionApplication.mjs";
import { createHostedScreenshotProductionApplication } from "../application/hostedScreenshotProductionApplication.mjs";
import { createPlatformMediaBindingApplication } from "../application/platformMediaBindingApplication.mjs";
import { createScreenshotDerivativeApplication } from "../application/screenshotDerivativeApplication.mjs";
import { createSystemClock, createSystemIdService } from "../domain/ports.mjs";
import { createCdpCaptureWorkerAdapter } from "../infrastructure/cdpCaptureWorkerAdapter.mjs";
import { createCdpImageProcessorAdapter } from "../infrastructure/cdpImageProcessorAdapter.mjs";
import { createPostgresCaptureRepository } from "../infrastructure/postgresCaptureAdapter.mjs";
import { createPostgresDurableJobRepository } from "../infrastructure/postgresDurableJobAdapter.mjs";
import { createPostgresMediaIntelligenceRepository } from "../infrastructure/postgresMediaIntelligenceAdapter.mjs";
import { resolveOwnerWorkspaceId } from "./githubConnectionDependencies.mjs";
import { createProductionHostedPrivateAssetStorage } from "./hostedAssetPreviewDependencies.mjs";
import { resolveOwnerUserId } from "./hostedPlanningDependencies.mjs";

export const HOSTED_SCREENSHOT_ENV = Object.freeze({
  browserWsEndpoint: "SIGNALFLOW_CDP_BROWSER_WS_ENDPOINT",
  captureEnvironment: "SIGNALFLOW_CAPTURE_ENVIRONMENT",
  allowInsecureLocalhost: "SIGNALFLOW_CAPTURE_ALLOW_INSECURE_LOCALHOST",
});

function configurationError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.status = 503;
  error.details = { ...details };
  return error;
}

function captureEnvironment(env = process.env) {
  const value = String(env?.[HOSTED_SCREENSHOT_ENV.captureEnvironment] || "preview").trim().toLowerCase();
  if (!/^[a-z0-9_-]{2,40}$/.test(value)) {
    throw configurationError(
      "hosted_capture_environment_invalid",
      "SignalFlow hosted capture environment is invalid.",
      { field: HOSTED_SCREENSHOT_ENV.captureEnvironment },
    );
  }
  return value;
}

function allowInsecureLocalhost(env = process.env) {
  return String(env?.[HOSTED_SCREENSHOT_ENV.allowInsecureLocalhost] || "").trim().toLowerCase() === "true";
}

export function hostedScreenshotConfigurationStatus(env = process.env) {
  const missing = [];
  if (!String(env?.[HOSTED_SCREENSHOT_ENV.browserWsEndpoint] || "").trim()) {
    missing.push(HOSTED_SCREENSHOT_ENV.browserWsEndpoint);
  }
  return Object.freeze({
    configured: missing.length === 0,
    missing,
    environment: captureEnvironment(env),
  });
}

export function createProductionHostedScreenshotProductionApplication({
  env = process.env,
  fetchImpl = globalThis.fetch,
  clock = createSystemClock(),
  idService = createSystemIdService("signalflow"),
  database,
  contentPlanningRepository,
  privateAssetStorageComposition = null,
  durableJobRepository = null,
  captureRepository = null,
  mediaIntelligenceRepository = null,
  captureWorkerAdapter = null,
  imageProcessorAdapter = null,
} = {}) {
  const workspaceId = resolveOwnerWorkspaceId(env);
  const userId = resolveOwnerUserId(env);
  if (!database || typeof database.query !== "function") {
    throw new TypeError("Hosted screenshot production requires the current hosted database executor.");
  }
  if (!contentPlanningRepository || typeof contentPlanningRepository.get !== "function" || typeof contentPlanningRepository.upsert !== "function") {
    throw new TypeError("Hosted screenshot production requires the current content-planning repository.");
  }

  const configuration = hostedScreenshotConfigurationStatus(env);
  if (!configuration.configured && !captureWorkerAdapter) {
    throw configurationError(
      "hosted_capture_worker_unconfigured",
      "SignalFlow hosted screenshot capture is not configured.",
      { missing: configuration.missing },
    );
  }

  const storage = privateAssetStorageComposition || createProductionHostedPrivateAssetStorage({
    env,
    fetchImpl,
    clock,
    database,
  });
  if (!storage?.privateStorage || !storage?.assetRepository) {
    throw new TypeError("Hosted screenshot production requires private Asset storage and its canonical Asset repository.");
  }

  const jobs = durableJobRepository || createPostgresDurableJobRepository({ database, workspaceId });
  const captures = captureRepository || createPostgresCaptureRepository({ database, workspaceId });
  const media = mediaIntelligenceRepository || createPostgresMediaIntelligenceRepository({ database, workspaceId });
  const environment = configuration.environment;
  const browserEndpoint = String(env?.[HOSTED_SCREENSHOT_ENV.browserWsEndpoint] || "").trim();
  const worker = captureWorkerAdapter || createCdpCaptureWorkerAdapter({
    browserWSEndpoint: browserEndpoint,
    allowedEnvironments: [environment],
    allowInsecureLocalhost: allowInsecureLocalhost(env),
  });
  const processor = imageProcessorAdapter || createCdpImageProcessorAdapter({
    browserWSEndpoint: browserEndpoint,
    allowInsecureLocalhost: allowInsecureLocalhost(env),
  });

  const captureExecutionApplication = createCaptureExecutionApplication({
    durableJobRepository: jobs,
    captureRepository: captures,
    captureWorkerAdapter: worker,
    privateAssetStorage: storage.privateStorage,
    clock,
    idService,
    environment,
    leaseOwner: "hosted-capture-request",
  });
  const exactCaptureExecutionApplication = createExactCaptureJobExecutionApplication({
    durableJobRepository: jobs,
    captureRepository: captures,
    captureExecutionApplication,
    clock,
    leaseOwner: "hosted-capture-request",
  });
  const screenshotDerivativeApplication = createScreenshotDerivativeApplication({
    mediaIntelligenceRepository: media,
    imageProcessorAdapter: processor,
    privateAssetStorage: storage.privateStorage,
    clock,
    idService,
  });
  const platformMediaBindingApplication = createPlatformMediaBindingApplication({
    contentPlanningRepository,
    assetRepository: storage.assetRepository,
    mediaIntelligenceRepository: media,
    workspaceId,
    userId,
    clock,
    idService,
  });
  const productionApplication = createHostedScreenshotProductionApplication({
    workspaceId,
    userId,
    contentPlanningRepository,
    durableJobRepository: jobs,
    captureRepository: captures,
    mediaIntelligenceRepository: media,
    privateAssetStorage: storage.privateStorage,
    exactCaptureExecutionApplication,
    screenshotDerivativeApplication,
    platformMediaBindingApplication,
    clock,
  });

  return Object.freeze({
    workspaceId,
    userId,
    environment,
    durableJobRepository: jobs,
    captureRepository: captures,
    mediaIntelligenceRepository: media,
    assetRepository: storage.assetRepository,
    privateAssetStorage: storage.privateStorage,
    productionApplication,
  });
}
