import { createContentOpportunityApplication } from "../application/contentOpportunityApplication.mjs";
import { createProjectContextApplication } from "../application/projectContextApplication.mjs";
import { createSignalOpportunityContinuationApplication } from "../application/signalOpportunityContinuationApplication.mjs";
import { createSystemClock, createSystemIdService } from "../domain/ports.mjs";
import { createPostgresContentOpportunityRepository } from "../infrastructure/postgresContentOpportunityAdapter.mjs";
import { createPostgresContentSignalRepository } from "../infrastructure/postgresConnectedSourceAdapters.mjs";
import { createPostgresProjectContextRepository } from "../infrastructure/postgresProjectContextAdapter.mjs";
import { createServerOpportunityInferenceAdapter } from "../infrastructure/serverInferenceAdapter.mjs";
import { createNeonQueryExecutor } from "./neonDatabase.mjs";

export function createHostedOpportunityCore({
  workspaceId,
  origin,
  env = process.env,
  fetchImpl = globalThis.fetch,
  clock = createSystemClock(),
  idService = createSystemIdService("signalflow"),
  database = null,
} = {}) {
  const db = database || createNeonQueryExecutor({ databaseUrl: env.DATABASE_URL });
  const contentSignalRepository = createPostgresContentSignalRepository({ database: db, workspaceId });
  const projectContextRepository = createPostgresProjectContextRepository({ database: db, workspaceId });
  const contentOpportunityRepository = createPostgresContentOpportunityRepository({ database: db, workspaceId });
  const inferenceAdapter = createServerOpportunityInferenceAdapter({
    origin,
    accessKey: env.SIGNALFLOW_ACCESS_KEY,
    fetchImpl,
  });
  const projectContextApplication = createProjectContextApplication({
    workspaceId,
    repository: projectContextRepository,
    clock,
    idService,
  });
  const opportunityApplication = createContentOpportunityApplication({
    workspaceId,
    contentOpportunityRepository,
    contentSignalRepository,
    inferenceAdapter,
    clock,
    idService,
  });
  const continuationApplication = createSignalOpportunityContinuationApplication({
    workspaceId,
    contentSignalRepository,
    projectContextApplication,
    contentOpportunityApplication: opportunityApplication,
  });

  return Object.freeze({
    database: db,
    contentSignalRepository,
    projectContextRepository,
    contentOpportunityRepository,
    projectContextApplication,
    opportunityApplication,
    continuationApplication,
  });
}
