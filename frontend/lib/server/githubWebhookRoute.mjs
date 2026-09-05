import { readGithubWebhookHeaders, verifyGithubWebhookSignature } from "./githubWebhookSecurity.mjs";

const JSON_HEADERS = Object.freeze({
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
});

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function errorCode(error) {
  return String(error?.code || "").trim().toLowerCase();
}

export function createGithubWebhookHandler({
  webhookSecret,
  resolveWebhookSecret = null,
  createIngestionApplication,
  maxBodyBytes = 5 * 1024 * 1024,
} = {}) {
  const staticSecret = String(webhookSecret || "");
  if (!staticSecret && typeof resolveWebhookSecret !== "function") {
    return async function unconfiguredGithubWebhook() {
      return jsonResponse(503, { error: "github_webhook_unconfigured" });
    };
  }
  if (resolveWebhookSecret !== null && typeof resolveWebhookSecret !== "function") {
    throw new TypeError("resolveWebhookSecret must be a function when provided.");
  }
  if (typeof createIngestionApplication !== "function") {
    throw new TypeError("GitHub webhook handler requires createIngestionApplication().");
  }

  return async function handleGithubWebhook(request) {
    let githubHeaders;
    try {
      githubHeaders = readGithubWebhookHeaders(request?.headers);
    } catch {
      return jsonResponse(400, { error: "github_webhook_headers_invalid" });
    }

    let rawBody;
    try {
      rawBody = Buffer.from(await request.arrayBuffer());
    } catch {
      return jsonResponse(400, { error: "github_webhook_body_unreadable" });
    }
    if (rawBody.byteLength > maxBodyBytes) {
      return jsonResponse(413, { error: "github_webhook_body_too_large" });
    }

    let payload = null;
    let secret = staticSecret;

    if (secret) {
      if (!verifyGithubWebhookSignature({
        rawBody,
        signatureHeader: githubHeaders.signatureHeader,
        secret,
      })) {
        return jsonResponse(401, { error: "github_webhook_signature_invalid" });
      }
      try {
        payload = JSON.parse(rawBody.toString("utf8"));
      } catch {
        return jsonResponse(400, { error: "github_webhook_json_invalid" });
      }
    } else {
      try {
        payload = JSON.parse(rawBody.toString("utf8"));
      } catch {
        return jsonResponse(400, { error: "github_webhook_json_invalid" });
      }
      try {
        secret = String(await resolveWebhookSecret({ payload, githubHeaders }) || "");
      } catch (error) {
        const code = errorCode(error);
        if (code === "signalflow_database_unconfigured" || code === "signalflow_database_invalid") {
          return jsonResponse(503, { error: "github_webhook_storage_unavailable" });
        }
        if (code === "github_source_ambiguous") {
          return jsonResponse(409, { error: "github_webhook_mapping_ambiguous" });
        }
        return jsonResponse(503, { error: "github_webhook_authority_unavailable" });
      }
      if (!secret || !verifyGithubWebhookSignature({
        rawBody,
        signatureHeader: githubHeaders.signatureHeader,
        secret,
      })) {
        return jsonResponse(401, { error: "github_webhook_signature_invalid" });
      }
    }

    let ingestion;
    try {
      ingestion = await createIngestionApplication();
      if (!ingestion || typeof ingestion.ingest !== "function") {
        throw new TypeError("GitHub ingestion application is unavailable.");
      }
    } catch (error) {
      const code = errorCode(error);
      if (code === "signalflow_database_unconfigured" || code === "signalflow_database_invalid") {
        return jsonResponse(503, { error: "github_webhook_storage_unavailable" });
      }
      return jsonResponse(503, { error: "github_webhook_ingestion_unavailable" });
    }

    try {
      const result = await ingestion.ingest({
        eventName: githubHeaders.eventName,
        deliveryId: githubHeaders.deliveryId,
        payload,
      });
      if (result.status === "ignored_unsupported") {
        return jsonResponse(202, { accepted: true, status: "ignored_unsupported" });
      }
      return jsonResponse(202, {
        accepted: true,
        status: result.status,
        signalId: result.signal?.signalId || null,
        shouldEvaluateOpportunity: Boolean(result.shouldEvaluateOpportunity),
      });
    } catch (error) {
      const code = errorCode(error);
      if (code === "github_source_not_authorized") {
        return jsonResponse(202, { accepted: true, status: "ignored_unmapped" });
      }
      if (code === "github_source_ambiguous") {
        return jsonResponse(409, { error: "github_webhook_mapping_ambiguous" });
      }
      if (code === "external_signal_idempotency_conflict") {
        return jsonResponse(409, { error: "github_webhook_idempotency_conflict" });
      }
      return jsonResponse(503, { error: "github_webhook_persistence_failed" });
    }
  };
}
