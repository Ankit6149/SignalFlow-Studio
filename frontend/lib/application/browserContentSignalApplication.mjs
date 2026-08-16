import { createContentSignalApplication } from "./contentSignalApplication.mjs";
import { createSystemIdService } from "../domain/ports.mjs";
import { createBrowserContentSignalRepository } from "../infrastructure/contentSignalAdapters.mjs";
import {
  createBrowserAssetRepository,
  createBrowserSourceArtifactRepository,
} from "../infrastructure/transferAdapters.mjs";

export function createBrowserContentSignalApplication({
  getStorage,
  key = "signalflow_content_signals_v1",
  limit = 250,
  workspaceId = "local-personal",
  actorRef = "local-owner",
  validateCanonicalReferences = true,
  clock,
  idService,
} = {}) {
  return createContentSignalApplication({
    contentSignalRepository: createBrowserContentSignalRepository({ getStorage, key, limit }),
    sourceArtifactRepository: validateCanonicalReferences
      ? createBrowserSourceArtifactRepository({ getStorage })
      : null,
    assetRepository: validateCanonicalReferences
      ? createBrowserAssetRepository({ getStorage })
      : null,
    workspaceId,
    actorRef,
    clock,
    idService: idService || createSystemIdService("signalflow"),
  });
}
