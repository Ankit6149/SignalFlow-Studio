import { requireOwnerAccess } from "../../../../_auth";
import {
  createProductionGithubSourceConnectionApplication,
  githubSourceConnectionConfigurationStatus,
} from "../../../../../../lib/server/githubConnectionDependencies.mjs";
import { createGithubConnectionHandlers } from "../../../../../../lib/server/githubConnectionRoutes.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const handlers = createGithubConnectionHandlers({
    requireOwnerAccess,
    configurationStatus: () => githubSourceConnectionConfigurationStatus(process.env),
    createApplication: () => createProductionGithubSourceConnectionApplication(),
  });
  return handlers.oauthCallback(request);
}
