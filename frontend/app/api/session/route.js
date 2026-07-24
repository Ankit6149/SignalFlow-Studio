import {
  clearSessionCookie,
  createSessionCookie,
  createSessionToken,
  requireOwnerAccess,
} from "../_auth";

export async function POST(request) {
  const expected = process.env.SIGNALFLOW_ACCESS_KEY;

  if (!expected) {
    return new Response(
      JSON.stringify({
        token: "",
        locked: false,
        message: "Access lock is disabled for this deployment.",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const accessKeyAccepted = body?.access_key === expected;
  if (!accessKeyAccepted) {
    const accessError = requireOwnerAccess(request);
    if (accessError) {
      return new Response(JSON.stringify({ error: "Invalid or expired owner session." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  const token = createSessionToken();
  return new Response(
    JSON.stringify({
      token,
      token_type: "Bearer",
      expires_in_days: 30,
      synchronized: !accessKeyAccepted,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": createSessionCookie(token),
      },
    },
  );
}

export async function DELETE() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": clearSessionCookie(),
    },
  });
}
