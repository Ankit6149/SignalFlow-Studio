import { createPlatformGenerationApplication } from "./platformGenerationApplication.mjs";
import { createBrowserStyleMemoryApplication } from "./browserStyleMemoryApplication.mjs";
import { withStyleLearningGeneration } from "./styleLearningDecorators.mjs";
import { createBrowserContentPlanningRepository } from "../infrastructure/contentPlanningAdapters.mjs";
import { createBrowserContentOpportunityRepository } from "../infrastructure/contentOpportunityAdapters.mjs";
import { createBrowserContentSignalRepository } from "../infrastructure/contentSignalAdapters.mjs";
import { createBrowserInferenceAdapter } from "../infrastructure/browserInferenceAdapter.mjs";
import { createBrowserIdentityApplication } from "./browserIdentityApplication.mjs";
import { createSystemIdService } from "../domain/ports.mjs";

export function createBrowserPlatformGenerationApplication({
  getStorage,
  planningKey = "signalflow_content_planning_v1",
  opportunityKey = "signalflow_content_opportunities_v1",
  signalKey = "signalflow_content_signals_v1",
  identityKey = "signalflow_identity_profiles_v1",
  styleMemoryKey = "signalflow_style_memory_v1",
  workspaceId = "local-personal",
  userId = "owner",
  clock,
  idService,
  fetchImpl,
} = {}) {
  const sharedIds = idService || createSystemIdService("signalflow");
  const planningRepository = createBrowserContentPlanningRepository({ getStorage, key: planningKey });
  const identityApplication = createBrowserIdentityApplication({
    getStorage,
    key: identityKey,
    workspaceId,
    userId,
    clock,
    idService: sharedIds,
  });
  const styleMemoryApplication = createBrowserStyleMemoryApplication({
    getStorage,
    key: styleMemoryKey,
    workspaceId,
    userId,
    clock,
    idService: sharedIds,
  });
  const generationApplication = createPlatformGenerationApplication({
    contentPlanningRepository: planningRepository,
    contentOpportunityRepository: createBrowserContentOpportunityRepository({ getStorage, key: opportunityKey }),
    contentSignalRepository: createBrowserContentSignalRepository({ getStorage, key: signalKey }),
    identityApplication,
    styleMemoryApplication,
    inferenceAdapter: createBrowserInferenceAdapter({ fetchImpl }),
    workspaceId,
    clock,
    idService: sharedIds,
  });
  return withStyleLearningGeneration({
    generationApplication,
    contentPlanningRepository: planningRepository,
    styleMemoryApplication,
    clock,
  });
}
