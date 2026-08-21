import { createGithubSignalIngestionApplication } from "../application/githubSignalIngestionApplication.mjs";
import { createGithubSignalOpportunityDispatchApplication } from "../application/githubSignalOpportunityDispatchApplication.mjs";
import {
  createPostgresContentSignalRepository,
  createPostgresSourceConnectionRepository,
} from "../infrastructure/postgresConnectedSourceAdapters.mjs";
import { createPostgresSignalOpportunityJobRepository } from "../infrastructure/postgresSignalOpportunityJobAdapter.mjs";
import { createNeonQueryExecutor } from "./neonDatabase.mjs";

export function createProductionGithubIngestionApplication({ databaseUrl = process.env.DATABASE_URL } = {}) {
  const database = createNeonQueryExecutor({ databaseUrl });
  const sourceConnectionRepository = createPostgresSourceConnectionRepository({
    database,
    trustedServerLookup: true,
  });
  const contentSignalRepository = createPostgresContentSignalRepository({ database });
  const opportunityJobRepository = createPostgresSignalOpportunityJobRepository({ database });

  const ingestionApplication = createGithubSignalIngestionApplication({
    sourceConnectionRepository,
    contentSignalRepository,
  });

  return createGithubSignalOpportunityDispatchApplication({
    ingestionApplication,
    opportunityJobRepository,
  });
}
