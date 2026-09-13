import { requireOwnerAccess } from "../../_auth";
import { fetchUrlContent } from "../../../../lib/context/linkFetcher";
import { internalErrorResponse } from "../../../../lib/server/safeApiErrors.mjs";

export async function POST(request) {
  const accessError = requireOwnerAccess(request);
  if (accessError) {
    return accessError;
  }

  try {
    const { urls } = await request.json();
    if (!urls || !Array.isArray(urls)) {
      return new Response(JSON.stringify({ error: "Missing or invalid urls array parameter" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const results = [];
    for (const url of urls) {
      if (url) {
        const fetched = await fetchUrlContent(url);
        if (fetched) {
          results.push(fetched);
        }
      }
    }

    return new Response(JSON.stringify({ linksContext: results }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return internalErrorResponse("context.links", err, {
      message: "SignalFlow could not read those links safely.",
    });
  }
}
