import { createSystemIdService } from "../domain/ports.mjs";
import { createGoldenPathAutopilotApplication } from "./goldenPathAutopilotApplication.mjs";
import { createBrowserContentOpportunityApplication } from "./browserContentOpportunityApplication.mjs";
import { createBrowserContentPlanningApplication } from "./browserContentPlanningApplication.mjs";
import { createBrowserPlatformGenerationApplication } from "./browserPlatformGenerationApplication.mjs";
import { createBrowserPlatformReviewApplication } from "./browserPlatformReviewApplication.mjs";
import { createBrowserIdentityApplication } from "./browserIdentityApplication.mjs";

export function createBrowserGoldenPathAutopilotApplication({
  getStorage,
  workspaceId = "local-personal",
  userId = "owner",
  fetchImpl,
  clock,
  idService,
} = {}) {
  const sharedIds = idService || createSystemIdService("signalflow");
  const shared = { getStorage, workspaceId, fetchImpl, clock, idService: sharedIds };
  return createGoldenPathAutopilotApplication({
    opportunityApplication: createBrowserContentOpportunityApplication(shared),
    planningApplication: createBrowserContentPlanningApplication({ ...shared, userId }),
    generationApplication: createBrowserPlatformGenerationApplication({ ...shared, userId }),
    reviewApplication: createBrowserPlatformReviewApplication({ ...shared, userId }),
    identityApplication: createBrowserIdentityApplication({ getStorage, workspaceId, userId, clock, idService: sharedIds }),
  });
}
