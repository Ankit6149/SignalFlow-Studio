import { requireOwnerAccess } from "../_auth";
import { getProviderConfigurationStatus } from "../../../lib/ai/providerStatus";
import {
  MODEL_GENERATION_PROVIDERS,
  canUseServerProviderConfiguration,
} from "../../../lib/ai/generationPolicy.mjs";

const LOCAL_PROVIDERS = new Set(["ollama", "lmstudio"]);

export async function GET(request) {
  try {
    const isOwner = requireOwnerAccess(request) === null;
    const publicHosted = process.env.SIGNALFLOW_PUBLIC_HOSTED === "true" || Boolean(process.env.VERCEL);
    const canUseServerConfiguration = canUseServerProviderConfiguration({
      publicHosted,
      allowServerKey: isOwner,
    });

    const allProviders = getProviderConfigurationStatus();
    const providers = Object.fromEntries(
      Object.entries(allProviders)
        .filter(([id]) => MODEL_GENERATION_PROVIDERS.has(id))
        .map(([id, provider]) => [id, {
          ...provider,
          configured: Boolean(provider.configured && canUseServerConfiguration),
          requiresBaseUrl: LOCAL_PROVIDERS.has(id) && publicHosted && !provider.configured,
        }]),
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
