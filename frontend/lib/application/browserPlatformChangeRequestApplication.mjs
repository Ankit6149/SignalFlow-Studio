import { createPlatformChangeRequestApplication } from "./platformChangeRequestApplication.mjs";
import { createBrowserStyleMemoryApplication } from "./browserStyleMemoryApplication.mjs";
import { withStyleLearningChangeRequests } from "./styleLearningDecorators.mjs";
import { createBrowserContentPlanningRepository } from "../infrastructure/contentPlanningAdapters.mjs";
import { createBrowserContentReviewRepository } from "../infrastructure/contentReviewAdapters.mjs";
import { createBrowserContentOpportunityRepository } from "../infrastructure/contentOpportunityAdapters.mjs";
import { createBrowserContentSignalRepository } from "../infrastructure/contentSignalAdapters.mjs";
import { createBrowserIdentityRepository } from "../infrastructure/identityAdapters.mjs";
import { createBrowserInferenceAdapter } from "../infrastructure/browserInferenceAdapter.mjs";
import { createSystemIdService } from "../domain/ports.mjs";

export function createBrowserPlatformChangeRequestApplication({
  getStorage,
  planningKey = "signalflow_content_planning_v1",
  reviewKey = "signalflow_content_reviews_v1",
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
  const styleMemoryApplication = createBrowserStyleMemoryApplication({
    getStorage,
    key: styleMemoryKey,
    workspaceId,
    userId,
    clock,
    idService: sharedIds,
  });
  const changeRequestApplication = createPlatformChangeRequestApplication({
    contentPlanningRepository: planningRepository,
    contentReviewRepository: createBrowserContentReviewRepository({ getStorage, key: reviewKey }),
    contentOpportunityRepository: createBrowserContentOpportunityRepository({ getStorage, key: opportunityKey }),
    contentSignalRepository: createBrowserContentSignalRepository({ getStorage, key: signalKey }),
    identityRepository: createBrowserIdentityRepository({ getStorage, key: identityKey }),
    styleMemoryApplication,
    inferenceAdapter: createBrowserInferenceAdapter({ fetchImpl }),
    workspaceId,
    userId,
    clock,
    idService: sharedIds,
  });
  return withStyleLearningChangeRequests({
    changeRequestApplication,
    contentPlanningRepository: planningRepository,
    styleMemoryApplication,
    clock,
  });
}
