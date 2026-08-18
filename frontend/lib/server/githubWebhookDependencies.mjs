import { createGithubSignalIngestionApplication } from "../application/githubSignalIngestionApplication.mjs";
import {
  createPostgresContentSignalRepository,
  createPostgresSourceConnectionRepository,
} from "../infrastructure/postgresConnectedSourceAdapters.mjs";
import { createNeonQueryExecutor } from "./neonDatabase.mjs";

export function createProductionGithubIngestionApplication({ databaseUrl = process.env.DATABASE_URL } = {}) {
  const database = createNeonQueryExecutor({ databaseUrl });
  const sourceConnectionRepository = createPostgresSourceConnectionRepository({
    database,
    trustedServerLookup: true,
  });
  const contentSignalRepository = createPostgresContentSignalRepository({ database });

  return createGithubSignalIngestionApplication({
    sourceConnectionRepository,
    contentSignalRepository,
  });
}
