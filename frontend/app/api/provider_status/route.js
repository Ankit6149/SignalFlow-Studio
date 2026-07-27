import { getProviderConfigurationStatus } from "../../../lib/ai/providerStatus";
import { MODEL_GENERATION_PROVIDERS } from "../../../lib/ai/generationPolicy.mjs";

export async function GET() {
  try {
    const allProviders = getProviderConfigurationStatus();
    const providers = Object.fromEntries(
      Object.entries(allProviders).filter(([id]) => MODEL_GENERATION_PROVIDERS.has(id)),
    );
    const requestedDefault = String(process.env.DEFAULT_MODEL_PROVIDER || "").trim().toLowerCase();
    const defaultProvider = MODEL_GENERATION_PROVIDERS.has(requestedDefault) ? requestedDefault : "";
    const recommendedProvider =
      (defaultProvider && providers[defaultProvider]?.configured ? defaultProvider : "") ||
      Object.keys(providers).find((id) => providers[id]?.configured) ||
      "gemini";

    return new Response(JSON.stringify({ providers, defaultProvider, recommendedProvider }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
