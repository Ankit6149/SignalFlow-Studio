import { createProjectContextApplication } from "./projectContextApplication.mjs";
import { createSystemClock, createSystemIdService } from "../domain/ports.mjs";
import { createBrowserProjectContextRepository } from "../infrastructure/projectContextAdapters.mjs";
import { createBrowserInferenceAdapter } from "../infrastructure/browserInferenceAdapter.mjs";

export function createBrowserProjectContextApplication({
  workspaceId = "owner-local",
  getStorage = () => globalThis.localStorage,
  storageKey = "signalflow_project_contexts_v1",
  inferenceAdapter = createBrowserInferenceAdapter(),
  clock = createSystemClock(),
  idService = createSystemIdService("sf"),
} = {}) {
  const repository = createBrowserProjectContextRepository({
    getStorage,
    key: storageKey,
  });
  return createProjectContextApplication({
    workspaceId,
    repository,
    inferenceAdapter,
    clock,
    idService,
  });
}
