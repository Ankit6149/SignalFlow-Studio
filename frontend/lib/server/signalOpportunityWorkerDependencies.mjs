import { createContentOpportunityApplication } from "../application/contentOpportunityApplication.mjs";
import { createGithubRepositoryBootstrapApplication } from "../application/githubRepositoryBootstrapApplication.mjs";
import { createGithubSignalEvidenceRefreshApplication } from "../application/githubSignalEvidenceRefreshApplication.mjs";
import { createProjectContextApplication } from "../application/projectContextApplication.mjs";
import { createSignalOpportunityContinuationApplication } from "../application/signalOpportunityContinuationApplication.mjs";
import { createSignalOpportunityWorkerApplication } from "../application/signalOpportunityWorkerApplication.mjs";
import { createSystemClock, createSystemIdService } from "../domain/ports.mjs";
import {
  createPostgresContentSignalRepository,
  createPostgresSourceConnectionRepository,
} from "../infrastructure/postgresConnectedSourceAdapters.mjs";
import { createPostgresContentOpportunityRepository } from "../infrastructure/postgresContentOpportunityAdapter.mjs";
import { createPostgresProjectContextRepository } from "../infrastructure/postgresProjectContextAdapter.mjs";
import { createPostgresSignalOpportunityJobRepository } from "../infrastructure/postgresSignalOpportunityJobAdapter.mjs";
import { createPostgresSourceArtifactRepository } from "../infrastructure/postgresSourceArtifactAdapter.mjs";
import {
  createServerOpportunityInferenceAdapter,
  createServerProjectContextInferenceAdapter,
} from "../infrastructure/serverInferenceAdapter.mjs";
import { readGithubAppConfiguration } from "../integrations/github/githubAppApi.mjs";
import { createGithubRepositoryApiClient } from "../integrations/github/githubRepositoryApi.mjs";
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

  function workspaceRepositories(workspaceId) {
    return {
      contentSignalRepository: createPostgresContentSignalRepository({ database, workspaceId }),
      sourceConnectionRepository: createPostgresSourceConnectionRepository({ database, workspaceId }),
      sourceArtifactRepository: createPostgresSourceArtifactRepository({ database, workspaceId }),
      projectContextRepository: createPostgresProjectContextRepository({ database, workspaceId }),
      contentOpportunityRepository: createPostgresContentOpportunityRepository({ database, workspaceId }),
    };
  }

  return createSignalOpportunityWorkerApplication({
    opportunityJobRepository,
    clock,
    async createEvidenceRefreshApplication(workspaceId) {
      const repositories = workspaceRepositories(workspaceId);
      return createGithubSignalEvidenceRefreshApplication({
        workspaceId,
        contentSignalRepository: repositories.contentSignalRepository,
        sourceConnectionRepository: repositories.sourceConnectionRepository,
        async createGithubRepositoryBootstrapApplication() {
          const config = readGithubAppConfiguration(env);
          const projectContextInference = createServerProjectContextInferenceAdapter({
            origin: inferenceOrigin,
            accessKey: env.SIGNALFLOW_ACCESS_KEY,
            fetchImpl,
          });
          const projectContextApplication = createProjectContextApplication({
            workspaceId,
            repository: repositories.projectContextRepository,
            inferenceAdapter: projectContextInference,
            clock,
            idService,
          });
          return createGithubRepositoryBootstrapApplication({
            workspaceId,
            sourceConnectionRepository: repositories.sourceConnectionRepository,
            sourceArtifactRepository: repositories.sourceArtifactRepository,
            projectContextApplication,
            githubRepositoryApi: createGithubRepositoryApiClient({
              appId: config.appId,
              privateKey: config.privateKey,
              fetchImpl,
            }),
            firstOpportunityApplication: null,
            clock,
          });
        },
      });
    },
    async createContinuationApplication(workspaceId) {
      const repositories = workspaceRepositories(workspaceId);
      const projectContextApplication = createProjectContextApplication({
        workspaceId,
        repository: repositories.projectContextRepository,
        clock,
        idService,
      });
      const contentOpportunityApplication = createContentOpportunityApplication({
        workspaceId,
        contentOpportunityRepository: repositories.contentOpportunityRepository,
        contentSignalRepository: repositories.contentSignalRepository,
        inferenceAdapter,
        clock,
        idService,
      });
      return createSignalOpportunityContinuationApplication({
        workspaceId,
        contentSignalRepository: repositories.contentSignalRepository,
        projectContextApplication,
        contentOpportunityApplication,
      });
    },
  });
}
