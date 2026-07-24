function cleanPlatformBody(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";
  try {
    const parsed = JSON.parse(text);
    return parsed.error_description || parsed.detail || parsed.message || parsed.title || text;
  } catch {
    return text;
  }
}

export async function createSocialApiError(response, platform, action) {
  const raw = await response.text().catch(() => "");
  const detail = cleanPlatformBody(raw);
  const retryAfter = response.headers.get("retry-after");
  let message;

  switch (response.status) {
    case 401:
      message = `${platform} authorization expired or was revoked. Reconnect the account and try again.`;
      break;
    case 403:
      message = `${platform} rejected ${action} because the connected app or account is missing a required permission or product approval.`;
      break;
    case 404:
      message = `${platform} could not find the requested publishing resource. Verify the API version and account configuration.`;
      break;
    case 409:
    case 422:
      message = `${platform} rejected the content or request format.`;
      break;
    case 429:
      message = `${platform} rate limit reached.${retryAfter ? ` Retry after ${retryAfter} seconds.` : " Try again later."}`;
      break;
    default:
      message = response.status >= 500
        ? `${platform} is temporarily unavailable while attempting ${action}.`
        : `${platform} ${action} failed with status ${response.status}.`;
  }

  if (detail) message += ` ${detail.slice(0, 500)}`;
  const error = new Error(message);
  error.status = response.status;
  error.platform = platform;
  error.action = action;
  error.retryAfter = retryAfter || null;
  return error;
}
