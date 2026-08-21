import { after } from "next/server";
import { createProductionGithubIngestionApplication } from "../../../../../lib/server/githubWebhookDependencies.mjs";
import { createGithubWebhookHandler } from "../../../../../lib/server/githubWebhookRoute.mjs";
import { createProductionSignalOpportunityWorker } from "../../../../../lib/server/signalOpportunityWorkerDependencies.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const handler = createGithubWebhookHandler({
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
    createIngestionApplication: () => createProductionGithubIngestionApplication(),
  });
  const response = await handler(request);

  if (response.status === 202) {
    const origin = new URL(request.url).origin;
    after(async () => {
      try {
        const worker = createProductionSignalOpportunityWorker({ origin });
        await worker.processNext();
      } catch {
        // The canonical outbox row remains pending/retryable. Webhook acknowledgement must not be rewritten after persistence.
      }
    });
  }

  return response;
}
