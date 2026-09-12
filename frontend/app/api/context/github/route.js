import { requireOwnerAccess } from "../../_auth";
import { ingestGitHubRepo } from "../../../../lib/context/github";
import { ingestLocalRepo } from "../../../../lib/context/localRepo";
import { internalErrorResponse } from "../../../../lib/server/safeApiErrors.mjs";

export async function POST(request) {
  const accessError = requireOwnerAccess(request);
  if (accessError) {
    return accessError;
  }

  try {
    const { repoUrl, githubToken } = await request.json();
    if (!repoUrl) {
      return new Response(JSON.stringify({ error: "Missing repoUrl parameter" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const isLocal = !repoUrl.includes("github.com") && 
      (repoUrl.startsWith("/") || 
       repoUrl.startsWith("\\") || 
       /^[a-zA-Z]:\\/.test(repoUrl) || 
       /^[a-zA-Z]:\//.test(repoUrl) || 
       repoUrl.startsWith(".") ||
       (!repoUrl.includes("http://") && !repoUrl.includes("https://")));

    const result = isLocal 
      ? await ingestLocalRepo(repoUrl) 
      : await ingestGitHubRepo(repoUrl, githubToken);
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return internalErrorResponse("context.github", err, {
      message: "SignalFlow could not read that repository safely.",
    });
  }
}
