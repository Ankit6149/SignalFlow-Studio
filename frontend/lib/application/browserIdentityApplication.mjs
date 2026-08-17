import { createIdentityApplication } from "./identityApplication.mjs";
import { createBrowserIdentityRepository } from "../infrastructure/identityAdapters.mjs";
import { createSystemIdService } from "../domain/ports.mjs";

export function createBrowserIdentityApplication({
  getStorage,
  key = "signalflow_identity_profiles_v1",
  workspaceId = "local-personal",
  userId = "owner",
  clock,
  idService,
} = {}) {
  return createIdentityApplication({
    identityRepository: createBrowserIdentityRepository({ getStorage, key }),
    workspaceId,
    userId,
    clock,
    idService: idService || createSystemIdService("signalflow"),
  });
}
