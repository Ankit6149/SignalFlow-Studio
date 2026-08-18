import { createProductionGithubIngestionApplication } from "../../../../../lib/server/githubWebhookDependencies.mjs";
import { createGithubWebhookHandler } from "../../../../../lib/server/githubWebhookRoute.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const handler = createGithubWebhookHandler({
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
    createIngestionApplication: () => createProductionGithubIngestionApplication(),
  });
  return handler(request);
}
