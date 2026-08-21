import { createSystemClock, createSystemIdService } from "../domain/ports.mjs";
import { resolveOwnerWorkspaceId } from "./githubConnectionDependencies.mjs";
import { createHostedOpportunityCore } from "./hostedOpportunityCore.mjs";

export function createProductionHostedOpportunityApplications({
  origin,
  env = process.env,
  fetchImpl = globalThis.fetch,
  clock = createSystemClock(),
  idService = createSystemIdService("signalflow"),
} = {}) {
  const workspaceId = resolveOwnerWorkspaceId(env);
  const core = createHostedOpportunityCore({
    workspaceId,
    origin,
    env,
    fetchImpl,
    clock,
    idService,
  });

  return Object.freeze({
    workspaceId,
    opportunityApplication: core.opportunityApplication,
    continuationApplication: core.continuationApplication,
  });
}
