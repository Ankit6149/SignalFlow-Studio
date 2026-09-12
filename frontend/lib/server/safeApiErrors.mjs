function safeCode(error) {
  const value = String(error?.code || "").trim().toLowerCase();
  return /^[a-z0-9][a-z0-9_:-]{0,79}$/.test(value) ? value : "internal_error";
}

export function logBoundedApiError(context, error) {
  console.error("SignalFlow API request failed", {
    context: String(context || "api").slice(0, 80),
    code: safeCode(error),
    status: Number.isInteger(error?.status) ? error.status : null,
  });
}

export function internalErrorResponse(context, error, {
  message = "SignalFlow could not complete that request.",
  status = 500,
  body = {},
} = {}) {
  logBoundedApiError(context, error);
  return new Response(JSON.stringify({ ...body, error: message }), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
