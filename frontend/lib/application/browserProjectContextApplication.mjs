import { createProjectContextApplication } from "./projectContextApplication.mjs";
import { createSystemClock, createSystemIdService } from "../domain/ports.mjs";
import { createBrowserProjectContextRepository } from "../infrastructure/projectContextAdapters.mjs";

export function createBrowserProjectContextApplication({
  workspaceId = "owner-local",
  getStorage = () => globalThis.localStorage,
  storageKey = "signalflow_project_contexts_v1",
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
    clock,
    idService,
  });
}
