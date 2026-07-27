import { requireOwnerAccess } from "../_auth";
import { generateText } from "../../../lib/ai/generateText";
import { assertModelGenerationProvider } from "../../../lib/ai/generationPolicy.mjs";

const OWNER_ONLY_ENDPOINT_PROVIDERS = new Set(["custom", "ollama", "lmstudio"]);

export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  let provider;
  try {
    provider = assertModelGenerationProvider(body.provider);
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const temporaryApiKey = String(body.temporaryApiKey || "").trim();
  const accessError = requireOwnerAccess(request);
  if (accessError && (OWNER_ONLY_ENDPOINT_PROVIDERS.has(provider) || !temporaryApiKey)) {
    return accessError;
  }

  const modelName = String(body.modelName || "").trim();
  const baseUrl = String(body.baseUrl || "").trim();
  const config = { apiKey: temporaryApiKey, baseUrl, modelName, maxTokens: 64 };

  try {
    await generateText({
      provider,
      prompt: 'Return only JSON: {"ok":true}',
      modelOverride: modelName,
      config,
    });
    return new Response(JSON.stringify({
      ok: true,
      provider,
      configured: true,
      modelUsed: modelName,
      message: "Connection successful.",
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({
      ok: false,
      provider,
      modelUsed: modelName,
      error: error.message,
      setupHint: getSetupHint(provider),
    }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
}

function getSetupHint(provider) {
  switch (provider) {
    case "gemini": return "Add a temporary Gemini key or configure GEMINI_API_KEY.";
    case "openai": return "Add a temporary OpenAI key or configure OPENAI_API_KEY.";
    case "claude": return "Add a temporary Anthropic key or configure ANTHROPIC_API_KEY.";
    case "groq": return "Add a temporary Groq key or configure GROQ_API_KEY.";
    case "openrouter": return "Add a temporary OpenRouter key or configure OPENROUTER_API_KEY.";
    case "custom": return "Configure a trusted OpenAI-compatible base URL and credentials.";
    case "ollama": return "Run SignalFlow where it can reach Ollama and load the requested model.";
    case "lmstudio": return "Run SignalFlow where it can reach LM Studio and load the requested model.";
    default: return "Configure the selected model provider.";
  }
}
