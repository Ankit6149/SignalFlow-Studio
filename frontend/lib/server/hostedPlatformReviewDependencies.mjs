import { createExactReviewPreparationApplication } from "../application/exactReviewPreparationApplication.mjs";
import { createIdentityApplication } from "../application/identityApplication.mjs";
import { createPlatformChangeRequestApplication } from "../application/platformChangeRequestApplication.mjs";
import { createPlatformGenerationApplication } from "../application/platformGenerationApplication.mjs";
import { createPlatformReviewApplication } from "../application/platformReviewApplication.mjs";
import { createTodayDecisionApplication } from "../application/todayDecisionApplication.mjs";
import { createSystemClock, createSystemIdService } from "../domain/ports.mjs";
import { createPostgresContentPlanningRepository } from "../infrastructure/postgresContentPlanningAdapter.mjs";
import { createPostgresContentReviewRepository } from "../infrastructure/postgresContentReviewAdapter.mjs";
import { createPostgresIdentityRepository } from "../infrastructure/postgresIdentityAdapter.mjs";
import { createServerPlatformWorkflowInferenceAdapter } from "../infrastructure/serverInferenceAdapter.mjs";
import { resolveOwnerWorkspaceId } from "./githubConnectionDependencies.mjs";
import { createHostedOpportunityCore } from "./hostedOpportunityCore.mjs";
import { resolveOwnerUserId } from "./hostedPlanningDependencies.mjs";

export function createProductionHostedPlatformReviewApplications({
  origin,
  env = process.env,
  fetchImpl = globalThis.fetch,
  clock = createSystemClock(),
  idService = createSystemIdService("signalflow"),
  database = null,
} = {}) {
  const workspaceId = resolveOwnerWorkspaceId(env);
  const userId = resolveOwnerUserId(env);
  const opportunityCore = createHostedOpportunityCore({
    workspaceId,
    origin,
    env,
    fetchImpl,
    clock,
    idService,
    database,
  });
  const identityRepository = createPostgresIdentityRepository({
    database: opportunityCore.database,
    workspaceId,
    userId,
  });
  const contentPlanningRepository = createPostgresContentPlanningRepository({
    database: opportunityCore.database,
    workspaceId,
  });
  const contentReviewRepository = createPostgresContentReviewRepository({
    database: opportunityCore.database,
    workspaceId,
  });
  const identityApplication = createIdentityApplication({
    identityRepository,
    workspaceId,
    userId,
    clock,
    idService,
  });
  const inferenceAdapter = createServerPlatformWorkflowInferenceAdapter({
    origin,
    accessKey: env.SIGNALFLOW_ACCESS_KEY,
    fetchImpl,
  });
  const generationApplication = createPlatformGenerationApplication({
    contentPlanningRepository,
    contentOpportunityRepository: opportunityCore.contentOpportunityRepository,
    contentSignalRepository: opportunityCore.contentSignalRepository,
    identityApplication,
    inferenceAdapter,
    workspaceId,
    clock,
    idService,
  });
  const reviewApplication = createPlatformReviewApplication({
    contentPlanningRepository,
    contentReviewRepository,
    contentOpportunityRepository: opportunityCore.contentOpportunityRepository,
    contentSignalRepository: opportunityCore.contentSignalRepository,
    identityRepository,
    identityApplication,
    inferenceAdapter,
    workspaceId,
    userId,
    clock,
    idService,
  });
  const changeApplication = createPlatformChangeRequestApplication({
    contentPlanningRepository,
    contentReviewRepository,
    contentOpportunityRepository: opportunityCore.contentOpportunityRepository,
    contentSignalRepository: opportunityCore.contentSignalRepository,
    identityRepository,
    inferenceAdapter,
    workspaceId,
    userId,
    clock,
    idService,
  });
  const todayApplication = createTodayDecisionApplication({
    contentPlanningRepository,
    contentReviewRepository,
    contentSignalRepository: opportunityCore.contentSignalRepository,
    contentOpportunityRepository: opportunityCore.contentOpportunityRepository,
    workspaceId,
  });
  const preparationReviewApplication = createExactReviewPreparationApplication({
    generationApplication,
    reviewApplication,
  });

  return Object.freeze({
    workspaceId,
    userId,
    database: opportunityCore.database,
    contentPlanningRepository,
    contentReviewRepository,
    contentOpportunityRepository: opportunityCore.contentOpportunityRepository,
    contentSignalRepository: opportunityCore.contentSignalRepository,
    identityRepository,
    identityApplication,
    generationApplication,
    reviewApplication,
    changeApplication,
    todayApplication,
    preparationReviewApplication,
  });
}
