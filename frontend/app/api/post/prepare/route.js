import { requireOwnerAccess } from "../../_auth";
import { preparePostingPackage } from "../../../../lib/post/preparePostingPackage";
import { internalErrorResponse } from "../../../../lib/server/safeApiErrors.mjs";

export async function POST(request) {
  const accessError = requireOwnerAccess(request);
  if (accessError) {
    return accessError;
  }

  try {
    const { platform, content, package: pkg } = await request.json();
    if (!platform || !content) {
      return new Response(JSON.stringify({ error: "Missing platform or content parameters" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const postingPackage = preparePostingPackage(platform, content, pkg || {});
    
    return new Response(JSON.stringify(postingPackage), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return internalErrorResponse("post.prepare", err, {
      message: "SignalFlow could not prepare that posting package.",
    });
  }
}
