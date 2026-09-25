import {
  GENERATION_LIMITS,
  generationLimitIssue,
} from "../package/generationLimits.mjs";

function byteLength(value) {
  return new TextEncoder().encode(String(value || "")).byteLength;
}

function oversizedIssue(actual) {
  return generationLimitIssue({
    code: "generation_limit.request_bytes",
    field: "request",
    actual,
    max: GENERATION_LIMITS.requestBytes,
    message: `Generation request is too large (${actual} bytes). Keep the request at or below ${GENERATION_LIMITS.requestBytes} bytes.`,
  });
}

export async function readGenerationRequestBody(request) {
  const declared = Number(request?.headers?.get?.("content-length"));
  if (Number.isFinite(declared) && declared > GENERATION_LIMITS.requestBytes) {
    return Object.freeze({
      ok: false,
      status: 413,
      code: "generation_limit_exceeded",
      error: "Generation request exceeds the server input budget.",
      issues: [oversizedIssue(declared)],
    });
  }

  const raw = await request.text();
  const actualBytes = byteLength(raw);
  if (actualBytes > GENERATION_LIMITS.requestBytes) {
    return Object.freeze({
      ok: false,
      status: 413,
      code: "generation_limit_exceeded",
      error: "Generation request exceeds the server input budget.",
      issues: [oversizedIssue(actualBytes)],
    });
  }

  try {
    return Object.freeze({
      ok: true,
      status: 200,
      body: raw ? JSON.parse(raw) : {},
      actualBytes,
    });
  } catch {
    return Object.freeze({
      ok: false,
      status: 400,
      code: "invalid_json",
      error: "Generation request body must be valid JSON.",
      issues: [],
    });
  }
}
