import { requireOwnerAccess } from "../_auth.js";
import {
  canUseServerProviderConfiguration,
  MODEL_GENERATION_PROVIDERS,
} from "../../../lib/ai/generationPolicy.mjs";
import { getProviderConfigurationStatus } from "../../../lib/ai/providerStatus.js";
import { getAllPlatformStatus } from "../../../lib/social/socialConfig.js";
import {
  createCapabilitySnapshot,
  DEPLOYMENT_PROFILES,
} from "../../../lib/capabilities/capabilityContract.mjs";

const LOCAL_PROVIDERS = new Set(["ollama", "lmstudio"]);
const OWNER_ONLY_PROVIDERS = new Set(["custom", "ollama", "lmstudio"]);

function deploymentProfile() {
  const publicHosted = process.env.SIGNALFLOW_PUBLIC_HOSTED === "true" || Boolean(process.env.VERCEL);
  if (publicHosted) return DEPLOYMENT_PROFILES.HOSTED;
  if (process.env.SIGNALFLOW_SELF_HOSTED === "true") return DEPLOYMENT_PROFILES.SELF_HOSTED;
  return DEPLOYMENT_PROFILES.LOCAL;
}

function buildProviderCapabilities({ profile, isOwner }) {
  const publicHosted = profile === DEPLOYMENT_PROFILES.HOSTED;
  const canUseServerCredentials = canUseServerProviderConfiguration({
    publicHosted,
    allowServerKey: isOwner,
  });
  const providerStatus = getProviderConfigurationStatus();

  return Object.fromEntries(
    Object.entries(providerStatus)
      .filter(([id]) => MODEL_GENERATION_PROVIDERS.has(id))
      .map(([id, provider]) => {
        const ownerOnly = OWNER_ONLY_PROVIDERS.has(id);
        const available = !ownerOnly || isOwner || !publicHosted;
        const configured = Boolean(provider.configured && canUseServerCredentials && available);
        const requiresBaseUrl = LOCAL_PROVIDERS.has(id) && publicHosted && !configured;
        const reason = available
          ? configured
            ? `${provider.label} is configured securely for this session.`
            : provider.supportsTemporaryKey
              ? `${provider.label} is available with a temporary personal key.`
              : requiresBaseUrl
                ? `${provider.label} requires a reachable trusted base URL in hosted mode.`
                : `${provider.label} can be configured for this deployment.`
          : `${provider.label} is restricted to authenticated owner or trusted local/self-hosted sessions.`;

        return [id, {
          id,
          label: provider.label,
          available,
          reason,
          configured,
          supportsTemporaryKey: Boolean(provider.supportsTemporaryKey),
          requiresBaseUrl,
          isLocal: Boolean(provider.isLocal),
          defaultModel: provider.defaultModel || "",
        }];
      }),
  );
}

function buildConnectorCapabilities({ isOwner }) {
  const statuses = getAllPlatformStatus();
  return Object.fromEntries(
    Object.entries(statuses).map(([id, connector]) => [id, {
      available: Boolean(isOwner && connector.configured),
      configured: Boolean(isOwner && connector.configured),
      label: connector.label,
      reason: !isOwner
        ? `${connector.label} connection management is restricted to the authenticated owner.`
        : connector.configured
          ? `${connector.label} credentials are configured; live authorization and publishing still require verification.`
          : `${connector.label} credentials are not configured.`,
    }]),
  );
}

export async function GET(request) {
  try {
    const profile = deploymentProfile();
    const publicHosted = profile === DEPLOYMENT_PROFILES.HOSTED;
    const accessConfigured = Boolean(process.env.SIGNALFLOW_ACCESS_KEY);
    const ownerAuthorized = accessConfigured
      ? requireOwnerAccess(request) === null
      : !publicHosted;
    const providers = buildProviderCapabilities({ profile, isOwner: ownerAuthorized });
    const canReadLocalFiles = !publicHosted && process.env.SIGNALFLOW_ALLOW_LOCAL_REPO === "true";

    const snapshot = createCapabilitySnapshot({
      productVersion: process.env.npm_package_version || "0.2.0",
      profile,
      publicHosted,
      session: {
        authenticated: ownerAuthorized,
        role: ownerAuthorized ? "owner" : "anonymous",
        accessConfigured,
        canGenerate: true,
        canUseServerCredentials: ownerAuthorized,
        canUseOwnerTools: ownerAuthorized,
        canManageConnections: ownerAuthorized,
        canReadLocalFiles,
      },
      providers,
      connectorCapabilities: buildConnectorCapabilities({ isOwner: ownerAuthorized }),
      cloud: {
        accounts: false,
        workspaces: false,
        database: false,
        objectStorage: false,
        backgroundJobs: false,
        autosave: false,
        collaboration: false,
      },
      extension: {
        bridgeReady: false,
        pageContext: false,
        screenshot: false,
        recording: false,
        reason: "Extension capture is installed as an experimental client, but acknowledged delivery is not ready in the current product.",
      },
      quotas: {
        enforced: false,
        reason: "SignalFlow billing quotas are not enabled for the current deployment.",
      },
    });

    return new Response(JSON.stringify(snapshot), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "SignalFlow could not determine deployment capabilities.",
      code: "capability_discovery_failed",
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  }
}
