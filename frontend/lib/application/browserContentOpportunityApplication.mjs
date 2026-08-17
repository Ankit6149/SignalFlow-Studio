import { createContentOpportunityApplication } from "./contentOpportunityApplication.mjs";
import { createSystemIdService } from "../domain/ports.mjs";
import { createBrowserContentSignalRepository } from "../infrastructure/contentSignalAdapters.mjs";
import { createBrowserContentOpportunityRepository } from "../infrastructure/contentOpportunityAdapters.mjs";
import { createHttpOpportunityEvaluator } from "../infrastructure/opportunityEvaluatorAdapters.mjs";

export function createBrowserContentOpportunityApplication({
  getStorage,
  signalKey = "signalflow_content_signals_v1",
  opportunityKey = "signalflow_content_opportunities_v1",
  workspaceId = "local-personal",
  fetchImpl = globalThis.fetch,
  endpoint = "/api/intelligence/opportunity",
  clock,
  idService,
} = {}) {
  return createContentOpportunityApplication({
    contentSignalRepository: createBrowserContentSignalRepository({ getStorage, key: signalKey }),
    contentOpportunityRepository: createBrowserContentOpportunityRepository({ getStorage, key: opportunityKey }),
    opportunityEvaluator: createHttpOpportunityEvaluator({ fetchImpl, endpoint }),
    workspaceId,
    clock,
    idService: idService || createSystemIdService("signalflow"),
  });
}
