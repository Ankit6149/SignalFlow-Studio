import { createSystemIdService } from "../domain/ports.mjs";
import { createGoldenPathAutopilotApplication } from "./goldenPathAutopilotApplication.mjs";
import { createBrowserContentOpportunityApplication } from "./browserContentOpportunityApplication.mjs";
import { createBrowserContentPlanningApplication } from "./browserContentPlanningApplication.mjs";
import { createBrowserPlatformGenerationApplication } from "./browserPlatformGenerationApplication.mjs";
import { createBrowserPlatformReviewApplication } from "./browserPlatformReviewApplication.mjs";
import { createBrowserIdentityApplication } from "./browserIdentityApplication.mjs";
import { createNarrativeMemoryApplication } from "./narrativeMemoryApplication.mjs";
import { createBrowserNarrativeMemoryRepository } from "../infrastructure/narrativeMemoryAdapters.mjs";

export function createBrowserGoldenPathAutopilotApplication({
  getStorage,
  workspaceId = "local-personal",
  userId = "owner",
  narrativeMemoryKey = "signalflow_narrative_memory_v1",
  fetchImpl,
  clock,
  idService,
} = {}) {
  const sharedIds = idService || createSystemIdService("signalflow");
  const shared = { getStorage, workspaceId, fetchImpl, clock, idService: sharedIds };
  const narrativeMemoryApplication = createNarrativeMemoryApplication({
    narrativeMemoryRepository: createBrowserNarrativeMemoryRepository({ getStorage, key: narrativeMemoryKey }),
    workspaceId,
    clock,
    idService: sharedIds,
  });
  return createGoldenPathAutopilotApplication({
    opportunityApplication: createBrowserContentOpportunityApplication(shared),
    planningApplication: createBrowserContentPlanningApplication({ ...shared, userId }),
    generationApplication: createBrowserPlatformGenerationApplication({ ...shared, userId }),
    reviewApplication: createBrowserPlatformReviewApplication({ ...shared, userId, narrativeMemoryKey }),
    identityApplication: createBrowserIdentityApplication({ getStorage, workspaceId, userId, clock, idService: sharedIds }),
    narrativeMemoryApplication,
  });
}
