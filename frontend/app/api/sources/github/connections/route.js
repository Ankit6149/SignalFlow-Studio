import { requireOwnerAccess } from "../../../_auth";
import {
  createProductionGithubSourceConnectionApplication,
  githubSourceConnectionConfigurationStatus,
} from "../../../../../lib/server/githubConnectionDependencies.mjs";
import { createGithubConnectionHandlers } from "../../../../../lib/server/githubConnectionRoutes.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function handlers() {
  return createGithubConnectionHandlers({
    requireOwnerAccess,
    configurationStatus: () => githubSourceConnectionConfigurationStatus(process.env),
    createApplication: () => createProductionGithubSourceConnectionApplication(),
  });
}

export async function GET(request) {
  return handlers().status(request);
}

export async function PATCH(request) {
  return handlers().mutate(request);
}
