import { createPlatformReviewApplication } from "./platformReviewApplication.mjs";
import { createIdentityApplication } from "./identityApplication.mjs";
import { createNarrativeMemoryApplication } from "./narrativeMemoryApplication.mjs";
import { createBrowserStyleMemoryApplication } from "./browserStyleMemoryApplication.mjs";
import { withStyleLearningReview } from "./styleLearningDecorators.mjs";
import { createBrowserContentPlanningRepository } from "../infrastructure/contentPlanningAdapters.mjs";
import { createBrowserContentReviewRepository } from "../infrastructure/contentReviewAdapters.mjs";
import { createBrowserContentOpportunityRepository } from "../infrastructure/contentOpportunityAdapters.mjs";
import { createBrowserContentSignalRepository } from "../infrastructure/contentSignalAdapters.mjs";
import { createBrowserIdentityRepository } from "../infrastructure/identityAdapters.mjs";
import { createBrowserNarrativeMemoryRepository } from "../infrastructure/narrativeMemoryAdapters.mjs";
import { createBrowserInferenceAdapter } from "../infrastructure/browserInferenceAdapter.mjs";
import { createSystemIdService } from "../domain/ports.mjs";

export function createBrowserPlatformReviewApplication({
  getStorage,
  planningKey = "signalflow_content_planning_v1",
  reviewKey = "signalflow_content_reviews_v1",
  opportunityKey = "signalflow_content_opportunities_v1",
  signalKey = "signalflow_content_signals_v1",
  identityKey = "signalflow_identity_profiles_v1",
  narrativeMemoryKey = "signalflow_narrative_memory_v1",
  styleMemoryKey = "signalflow_style_memory_v1",
  workspaceId = "local-personal",
  userId = "owner",
  clock,
  idService,
  fetchImpl,
} = {}) {
  const sharedIds = idService || createSystemIdService("signalflow");
  const planningRepository = createBrowserContentPlanningRepository({ getStorage, key: planningKey });
  const identityRepository = createBrowserIdentityRepository({ getStorage, key: identityKey });
  const identityApplication = createIdentityApplication({
    identityRepository,
    workspaceId,
    userId,
    clock,
    idService: sharedIds,
  });
  const narrativeMemoryApplication = createNarrativeMemoryApplication({
    narrativeMemoryRepository: createBrowserNarrativeMemoryRepository({ getStorage, key: narrativeMemoryKey }),
    workspaceId,
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
  const reviewApplication = createPlatformReviewApplication({
    contentPlanningRepository: planningRepository,
    contentReviewRepository: createBrowserContentReviewRepository({ getStorage, key: reviewKey }),
    contentOpportunityRepository: createBrowserContentOpportunityRepository({ getStorage, key: opportunityKey }),
    contentSignalRepository: createBrowserContentSignalRepository({ getStorage, key: signalKey }),
    identityRepository,
    identityApplication,
    narrativeMemoryApplication,
    inferenceAdapter: createBrowserInferenceAdapter({ fetchImpl }),
    workspaceId,
    userId,
    clock,
    idService: sharedIds,
  });
  return withStyleLearningReview({
    reviewApplication,
    contentPlanningRepository: planningRepository,
    styleMemoryApplication,
    clock,
  });
}
