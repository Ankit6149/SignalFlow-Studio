import { createSystemIdService } from "../domain/ports.mjs";
import { createContentOpportunityApplication } from "./contentOpportunityApplication.mjs";
import { createBrowserContentSignalRepository } from "../infrastructure/contentSignalAdapters.mjs";
import { createBrowserContentOpportunityRepository } from "../infrastructure/contentOpportunityAdapters.mjs";
import { createBrowserInferenceAdapter } from "../infrastructure/browserInferenceAdapter.mjs";

export function createBrowserContentOpportunityApplication({
  getStorage,
  signalKey = "signalflow_content_signals_v1",
  opportunityKey = "signalflow_content_opportunities_v1",
  limit = 250,
  workspaceId = "local-personal",
  clock,
  idService,
  fetchImpl,
} = {}) {
  return createContentOpportunityApplication({
    contentOpportunityRepository: createBrowserContentOpportunityRepository({
      getStorage,
      key: opportunityKey,
      limit,
    }),
    contentSignalRepository: createBrowserContentSignalRepository({
      getStorage,
      key: signalKey,
      limit,
    }),
    inferenceAdapter: createBrowserInferenceAdapter({ fetchImpl }),
    workspaceId,
    clock,
    idService: idService || createSystemIdService("signalflow"),
  });
}
