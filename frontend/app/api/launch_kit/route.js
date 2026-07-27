import { requireOwnerAccess } from "../_auth";
import { validateGenerationInputs } from "../../../lib/package/validatePackage";
import {
  normalizeDocumentText,
  normalizeTextInput,
} from "../../../lib/package/inputNormalization.mjs";
import { ingestGitHubRepo } from "../../../lib/context/github";
import { ingestLocalRepo } from "../../../lib/context/localRepo";
import { fetchUrlContent } from "../../../lib/context/linkFetcher";
import { generateStudioPackage } from "../../../lib/ai/generateStudioPackage";
import { assertModelGenerationProvider } from "../../../lib/ai/generationPolicy.mjs";

export const maxDuration = 60;

export async function POST(request) {
  const accessError = requireOwnerAccess(request);
  const isOwner = accessError === null;

  try {
    const parsedBody = await request.json();
    const body = parsedBody && typeof parsedBody === "object" && !Array.isArray(parsedBody)
      ? parsedBody
      : {};
    const requestedGenerator = normalizeTextInput(body.generator) || normalizeTextInput(process.env.DEFAULT_MODEL_PROVIDER);
    let generator;
    try {
      generator = assertModelGenerationProvider(requestedGenerator);
    } catch (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const providerApiKey = normalizeTextInput(body.providerApiKey);

    if (!isOwner && Boolean(process.env.SIGNALFLOW_ACCESS_KEY) && !providerApiKey) {
      return new Response(
        JSON.stringify({
          error: "This hosted workspace is private. Enter the owner's access key or supply your own personal API key to use a cloud provider.",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const validation = validateGenerationInputs(body);
    if (!validation.valid) {
      return new Response(JSON.stringify({
        ok: false,
        error: "Validation failed",
        warnings: validation.errors,
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const projectName = normalizeTextInput(body.project_name ?? body.projectName) || "SignalFlow Studio Project";
    const notes = normalizeTextInput(body.notes);
    const audience = normalizeTextInput(body.audience) || "developers, founders, and creators";
    const repoUrl = normalizeTextInput(body.repo);
    const docsUrl = normalizeTextInput(body.docs_url) || normalizeTextInput(body.research_url);
    const appUrl = normalizeTextInput(body.app_url) || normalizeTextInput(body.appUrl);
    const enableAutoCapture = Boolean(body.enable_auto_capture || body.enableAutoCapture);

    const selectedChannels = Array.isArray(body.channels)
      ? body.channels.map(normalizeTextInput).filter(Boolean)
      : [];
    const selectedOutputs = Array.isArray(body.output_types)
      ? body.output_types.map(normalizeTextInput).filter(Boolean)
      : [];

    const modelName = normalizeTextInput(body.model_name);
    const modelEndpoint = normalizeTextInput(body.model_endpoint);
    const providerModelName = normalizeTextInput(body.providerModelName);
    const providerBaseUrl = normalizeTextInput(body.providerBaseUrl);
    const documentText = normalizeDocumentText(body.document_text);

    const warnings = [];
    let repoContext = null;
    const linksContext = [];
    const mediaItems = Array.isArray(body.media_items) ? [...body.media_items] : [];
    const githubToken = normalizeTextInput(body.github_token) || normalizeTextInput(body.githubToken);

    if (repoUrl) {
      try {
        const isLocal = !repoUrl.includes("github.com") &&
          (repoUrl.startsWith("/") ||
           repoUrl.startsWith("\\") ||
           /^[a-zA-Z]:\\/.test(repoUrl) ||
           /^[a-zA-Z]:\//.test(repoUrl) ||
           repoUrl.startsWith(".") ||
           (!repoUrl.includes("http://") && !repoUrl.includes("https://")));

        repoContext = isLocal
          ? await ingestLocalRepo(repoUrl)
          : await ingestGitHubRepo(repoUrl, githubToken);

        if (repoContext?.warnings?.length) warnings.push(...repoContext.warnings);
      } catch (error) {
        warnings.push(`Repository ingestion failed: ${error.message}. Generating with available inputs.`);
      }
    }

    if (docsUrl) {
      const urls = docsUrl.split(/\s+/).filter(Boolean);
      for (const url of urls) {
        try {
          const fetchResult = await fetchUrlContent(url);
          if (fetchResult) {
            linksContext.push(fetchResult);
            if (fetchResult.warnings?.length) warnings.push(...fetchResult.warnings);
          }
        } catch (error) {
          warnings.push(`Scraping docs link "${url}" failed: ${error.message}.`);
        }
      }
    }

    if (appUrl) {
      warnings.push("Automatic app capture is disabled in the main flow. Upload screenshots or record manually.");
    }
    void enableAutoCapture;

    const result = await generateStudioPackage({
      projectName,
      notes,
      audience,
      repoContext,
      linksContext,
      fileNames: documentText,
      mediaItems,
      selectedChannels,
      selectedOutputs,
      generator,
      model_name: providerModelName || modelName,
      model_endpoint: providerBaseUrl || modelEndpoint,
      appUrl,
      config: {
        apiKey: providerApiKey,
        baseUrl: providerBaseUrl,
        modelName: providerModelName,
        allowServerKey: isOwner,
      },
    });

    const allWarnings = Array.from(new Set([...warnings, ...(result.warnings || [])]));
    return new Response(JSON.stringify({ ...result, warnings: allWarnings }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      ok: false,
      error: `Server failed to assemble kit: ${error.message}`,
      warnings: [error.message],
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
