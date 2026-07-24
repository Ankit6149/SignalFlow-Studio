import { clearSessionCookie, createSessionCookie, createSessionToken } from "../_auth";

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

  const body = await request.json();

  if (body?.access_key !== expected) {
    return new Response(JSON.stringify({ error: "Invalid access key." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const token = createSessionToken();
  return new Response(
    JSON.stringify({
      token,
      token_type: "Bearer",
      expires_in_days: 30,
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
