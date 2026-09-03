import { createHostedGp2PreparationApplication } from "../application/hostedGp2PreparationApplication.mjs";
import { createSystemClock, createSystemIdService } from "../domain/ports.mjs";
import { createProductionHostedPlatformReviewApplications } from "./hostedPlatformReviewDependencies.mjs";
import { createProductionHostedScreenshotProductionApplication } from "./hostedScreenshotProductionDependencies.mjs";

export function createProductionHostedGp2PreparationApplication({
  origin,
  env = process.env,
  fetchImpl = globalThis.fetch,
  clock = createSystemClock(),
  idService = createSystemIdService("signalflow"),
  database = null,
} = {}) {
  const reviewApps = createProductionHostedPlatformReviewApplications({
    origin,
    env,
    fetchImpl,
    clock,
    idService,
    database,
  });

  let screenshotComposition = null;
  function screenshotProductionFactory() {
    if (!screenshotComposition) {
      screenshotComposition = createProductionHostedScreenshotProductionApplication({
        env,
        fetchImpl,
        clock,
        idService,
        database: reviewApps.database,
        contentPlanningRepository: reviewApps.contentPlanningRepository,
      });
    }
    return screenshotComposition.productionApplication;
  }

  const preparationApplication = createHostedGp2PreparationApplication({
    contentPlanningRepository: reviewApps.contentPlanningRepository,
    generationApplication: reviewApps.generationApplication,
    reviewPreparationApplication: reviewApps.preparationReviewApplication,
    screenshotProductionFactory,
  });

  return Object.freeze({
    workspaceId: reviewApps.workspaceId,
    userId: reviewApps.userId,
    database: reviewApps.database,
    contentPlanningRepository: reviewApps.contentPlanningRepository,
    generationApplication: reviewApps.generationApplication,
    reviewPreparationApplication: reviewApps.preparationReviewApplication,
    preparationApplication,
  });
}
