import {
  clearSessionCookie,
  createSessionCookie,
  createSessionToken,
  getOwnerAccessConfiguration,
  requireOwnerAccess,
  verifyOwnerAccessKey,
} from "../_auth";

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store, max-age=0",
      ...headers,
    },
  });
}

export async function GET(request) {
  const configuration = getOwnerAccessConfiguration();
  return json({
    authenticated: requireOwnerAccess(request) === null,
    locked: configuration.locked,
    owner_access_configured: configuration.configured,
    misconfigured: configuration.publicHosted && !configuration.configured,
  });
}

export async function POST(request) {
  const configuration = getOwnerAccessConfiguration();

  if (!configuration.configured) {
    if (configuration.publicHosted) {
      return json({
        authenticated: false,
        locked: true,
        owner_access_configured: false,
        code: "owner_access_unconfigured",
        error: "Owner access is unavailable because this public hosted deployment has no owner access lock configured.",
      }, 503);
    }
    return json({
      authenticated: true,
      locked: false,
      owner_access_configured: false,
      message: "Access lock is disabled for this local or self-hosted deployment.",
    });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  if (!verifyOwnerAccessKey(body?.access_key)) {
    const accessError = requireOwnerAccess(request);
    if (accessError) {
      return json({ error: "Invalid or expired owner session." }, 401);
    }
  }

  const token = createSessionToken();
  return json({
    authenticated: true,
    locked: true,
    owner_access_configured: true,
    expires_in_days: 30,
  }, 200, {
    "Set-Cookie": createSessionCookie(token),
  });
}

export async function DELETE() {
  return json({ ok: true }, 200, {
    "Set-Cookie": clearSessionCookie(),
  });
}
