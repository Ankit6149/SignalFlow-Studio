import { createTodayDecisionApplication } from "./todayDecisionApplication.mjs";
import { createBrowserContentPlanningRepository } from "../infrastructure/contentPlanningAdapters.mjs";
import { createBrowserContentReviewRepository } from "../infrastructure/contentReviewAdapters.mjs";
import { createBrowserContentOpportunityRepository } from "../infrastructure/contentOpportunityAdapters.mjs";
import { createBrowserContentSignalRepository } from "../infrastructure/contentSignalAdapters.mjs";

export function createBrowserTodayDecisionApplication({
  getStorage,
  planningKey = "signalflow_content_planning_v1",
  reviewKey = "signalflow_content_reviews_v1",
  opportunityKey = "signalflow_content_opportunities_v1",
  signalKey = "signalflow_content_signals_v1",
  workspaceId = "local-personal",
} = {}) {
  return createTodayDecisionApplication({
    contentPlanningRepository: createBrowserContentPlanningRepository({ getStorage, key: planningKey }),
    contentReviewRepository: createBrowserContentReviewRepository({ getStorage, key: reviewKey }),
    contentOpportunityRepository: createBrowserContentOpportunityRepository({ getStorage, key: opportunityKey }),
    contentSignalRepository: createBrowserContentSignalRepository({ getStorage, key: signalKey }),
    workspaceId,
  });
}
