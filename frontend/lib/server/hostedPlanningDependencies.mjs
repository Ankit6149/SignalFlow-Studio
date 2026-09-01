import { createContentPlanningApplication } from "../application/contentPlanningApplication.mjs";
import { createIdentityApplication } from "../application/identityApplication.mjs";
import { createSystemClock, createSystemIdService } from "../domain/ports.mjs";
import { createPostgresContentPlanningRepository } from "../infrastructure/postgresContentPlanningAdapter.mjs";
import { createPostgresIdentityRepository } from "../infrastructure/postgresIdentityAdapter.mjs";
import { createServerNarrativeStrategyInferenceAdapter } from "../infrastructure/serverInferenceAdapter.mjs";
import { resolveOwnerWorkspaceId } from "./githubConnectionDependencies.mjs";
import { createHostedOpportunityCore } from "./hostedOpportunityCore.mjs";

export function resolveOwnerUserId(env = process.env) {
  return String(env.SIGNALFLOW_OWNER_USER_ID || "owner").trim() || "owner";
}

export function createProductionHostedPlanningApplications({
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
  const identityApplication = createIdentityApplication({
    identityRepository,
    workspaceId,
    userId,
    clock,
    idService,
  });
  const inferenceAdapter = createServerNarrativeStrategyInferenceAdapter({
    origin,
    accessKey: env.SIGNALFLOW_ACCESS_KEY,
    fetchImpl,
  });
  const planningApplication = createContentPlanningApplication({
    contentPlanningRepository,
    contentOpportunityRepository: opportunityCore.contentOpportunityRepository,
    contentSignalRepository: opportunityCore.contentSignalRepository,
    projectContextRepository: opportunityCore.projectContextRepository,
    identityApplication,
    inferenceAdapter,
    workspaceId,
    clock,
    idService,
  });

  return Object.freeze({
    workspaceId,
    userId,
    database: opportunityCore.database,
    identityRepository,
    contentPlanningRepository,
    identityApplication,
    planningApplication,
  });
}
