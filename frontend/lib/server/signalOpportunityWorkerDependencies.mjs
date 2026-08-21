import { createContentOpportunityApplication } from "../application/contentOpportunityApplication.mjs";
import { createProjectContextApplication } from "../application/projectContextApplication.mjs";
import { createSignalOpportunityContinuationApplication } from "../application/signalOpportunityContinuationApplication.mjs";
import { createSignalOpportunityWorkerApplication } from "../application/signalOpportunityWorkerApplication.mjs";
import { createSystemClock, createSystemIdService } from "../domain/ports.mjs";
import { createPostgresContentOpportunityRepository } from "../infrastructure/postgresContentOpportunityAdapter.mjs";
import { createPostgresContentSignalRepository } from "../infrastructure/postgresConnectedSourceAdapters.mjs";
import { createPostgresProjectContextRepository } from "../infrastructure/postgresProjectContextAdapter.mjs";
import { createPostgresSignalOpportunityJobRepository } from "../infrastructure/postgresSignalOpportunityJobAdapter.mjs";
import { createServerOpportunityInferenceAdapter } from "../infrastructure/serverInferenceAdapter.mjs";
import { createNeonQueryExecutor } from "./neonDatabase.mjs";

export function createProductionSignalOpportunityWorker({
  origin,
  env = process.env,
  fetchImpl = globalThis.fetch,
  clock = createSystemClock(),
  idService = createSystemIdService("signalflow"),
} = {}) {
  const database = createNeonQueryExecutor({ databaseUrl: env.DATABASE_URL });
  const opportunityJobRepository = createPostgresSignalOpportunityJobRepository({ database });
  const inferenceOrigin = String(env.SIGNALFLOW_INTERNAL_ORIGIN || origin || "").trim();
  const inferenceAdapter = createServerOpportunityInferenceAdapter({
    origin: inferenceOrigin,
    accessKey: env.SIGNALFLOW_ACCESS_KEY,
    fetchImpl,
  });

  return createSignalOpportunityWorkerApplication({
    opportunityJobRepository,
    clock,
    async createContinuationApplication(workspaceId) {
      const contentSignalRepository = createPostgresContentSignalRepository({ database, workspaceId });
      const projectContextRepository = createPostgresProjectContextRepository({ database, workspaceId });
      const contentOpportunityRepository = createPostgresContentOpportunityRepository({ database, workspaceId });
      const projectContextApplication = createProjectContextApplication({
        workspaceId,
        repository: projectContextRepository,
        clock,
        idService,
      });
      const contentOpportunityApplication = createContentOpportunityApplication({
        workspaceId,
        contentOpportunityRepository,
        contentSignalRepository,
        inferenceAdapter,
        clock,
        idService,
      });
      return createSignalOpportunityContinuationApplication({
        workspaceId,
        contentSignalRepository,
        projectContextApplication,
        contentOpportunityApplication,
      });
    },
  });
}
