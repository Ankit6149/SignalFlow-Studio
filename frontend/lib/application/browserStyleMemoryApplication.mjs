import { createStyleMemoryApplication } from "./styleMemoryApplication.mjs";
import { createBrowserStyleMemoryRepository } from "../infrastructure/styleMemoryAdapters.mjs";
import { createSystemIdService } from "../domain/ports.mjs";

export function createBrowserStyleMemoryApplication({
  getStorage,
  key = "signalflow_style_memory_v1",
  workspaceId = "local-personal",
  userId = "owner",
  clock,
  idService,
} = {}) {
  const sharedIds = idService || createSystemIdService("signalflow");
  return createStyleMemoryApplication({
    styleMemoryRepository: createBrowserStyleMemoryRepository({ getStorage, key }),
    workspaceId,
    userId,
    clock,
    idService: sharedIds,
  });
}
