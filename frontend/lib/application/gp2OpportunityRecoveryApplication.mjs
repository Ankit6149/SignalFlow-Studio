import { assertPort, createSystemClock } from "../domain/ports.mjs";

export const GP2_RECOVERABLE_OPPORTUNITY_ERROR_CODES = Object.freeze([
  "inference_route_unavailable",
  "vercel_gateway_http_401",
  "vercel_gateway_http_403",
]);

function requiredOpaque(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length > 240 || /[/\\]|^[a-zA-Z]:/.test(normalized)) {
    throw new TypeError(`${field} must be an opaque identifier.`);
  }
  return normalized;
}

export function createGp2OpportunityRecoveryApplication({
  workspaceId,
  opportunityJobRepository,
  clock = createSystemClock(),
} = {}) {
  const ownerWorkspaceId = requiredOpaque(workspaceId, "workspaceId");
  const jobs = assertPort("opportunityJobRepository", opportunityJobRepository);
  if (typeof jobs.requeueDead !== "function") {
    throw new TypeError("GP2 opportunity recovery requires opportunityJobRepository.requeueDead().");
  }
  const time = assertPort("clock", clock);

  async function requeueBlocked({ limit = 3 } = {}) {
    const boundedLimit = Math.max(1, Math.min(5, Math.round(Number(limit) || 3)));
    const recovered = await jobs.requeueDead({
      workspaceId: ownerWorkspaceId,
      errorCodes: GP2_RECOVERABLE_OPPORTUNITY_ERROR_CODES,
      now: time.now(),
      limit: boundedLimit,
    });
    return Object.freeze({
      recoveredCount: Array.isArray(recovered) ? recovered.length : 0,
      processingBudget: Array.isArray(recovered) ? recovered.length : 0,
    });
  }

  return Object.freeze({ requeueBlocked });
}
