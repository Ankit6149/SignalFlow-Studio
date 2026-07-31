export const CAPABILITY_SCHEMA_VERSION = 1;
export const CAPABILITY_PRODUCT = "signalflow-studio";
export const PORTABLE_TRANSFER_SCHEMA_VERSION = 1;
export const PORTABLE_TRANSFER_BROWSER_MAX_BYTES = 50 * 1024 * 1024;
export const EXTENSION_PROTOCOL_VERSION = 1;

export const DEPLOYMENT_PROFILES = Object.freeze({
  HOSTED: "hosted",
  LOCAL: "local",
  SELF_HOSTED: "self_hosted",
});

const KNOWN_PROFILES = new Set(Object.values(DEPLOYMENT_PROFILES));

function text(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function boolean(value) {
  return value === true;
}

export function capability(available, reason, details = {}) {
  return {
    available: Boolean(available),
    reason: text(
      reason,
      available ? "Available in this SignalFlow session." : "Unavailable in this SignalFlow session.",
    ),
    ...details,
  };
}

function unavailable(reason) {
  return capability(false, reason);
}

function normalizeCapability(value, fallbackReason) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return unavailable(fallbackReason);
  }
  return capability(boolean(value.available), value.reason || fallbackReason, {
    ...Object.fromEntries(
      Object.entries(value).filter(([key]) => !["available", "reason"].includes(key)),
    ),
  });
}

function normalizeProviderMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).map(([id, provider]) => [id, {
      id,
      label: text(provider?.label, id),
      available: boolean(provider?.available),
      reason: text(
        provider?.reason,
        `${id} is unavailable in this SignalFlow session.`,
      ),
      configured: boolean(provider?.configured),
      supportsTemporaryKey: boolean(provider?.supportsTemporaryKey),
      requiresBaseUrl: boolean(provider?.requiresBaseUrl),
      isLocal: boolean(provider?.isLocal),
      defaultModel: text(provider?.defaultModel),
    }]),
  );
}

export function createCapabilitySnapshot({
  productVersion = "0.0.0",
  profile = DEPLOYMENT_PROFILES.LOCAL,
  publicHosted = false,
  session = {},
  providers = {},
  connectorCapabilities = {},
  cloud = {},
  extension = {},
  transfer = {},
  quotas = {},
  now = new Date().toISOString(),
} = {}) {
  const normalizedProfile = KNOWN_PROFILES.has(profile)
    ? profile
    : DEPLOYMENT_PROFILES.LOCAL;
  const isOwner = session.role === "owner" || session.role === "admin";
  const authenticated = Boolean(session.authenticated || isOwner);
  const cloudDatabase = Boolean(cloud.database);
  const objectStorage = Boolean(cloud.objectStorage);
  const backgroundJobs = Boolean(cloud.backgroundJobs);
  const collaboration = Boolean(cloud.collaboration);
  const autosave = Boolean(cloud.autosave && cloudDatabase);
  const localProfile = normalizedProfile !== DEPLOYMENT_PROFILES.HOSTED;
  const extensionBridgeReady = Boolean(extension.bridgeReady);

  const providerMap = Object.fromEntries(
    Object.entries(providers).map(([id, provider]) => {
      const available = Boolean(provider.available);
      return [id, {
        id,
        label: text(provider.label, id),
        available,
        reason: text(
          provider.reason,
          available
            ? `${provider.label || id} can be selected in this session.`
            : `${provider.label || id} is unavailable in this session.`,
        ),
        configured: Boolean(provider.configured),
        supportsTemporaryKey: Boolean(provider.supportsTemporaryKey),
        requiresBaseUrl: Boolean(provider.requiresBaseUrl),
        isLocal: Boolean(provider.isLocal),
        defaultModel: text(provider.defaultModel),
      }];
    }),
  );

  return {
    schemaVersion: CAPABILITY_SCHEMA_VERSION,
    product: CAPABILITY_PRODUCT,
    productVersion: text(productVersion, "0.0.0"),
    generatedAt: text(now, new Date().toISOString()),
    deployment: {
      profile: normalizedProfile,
      publicHosted: Boolean(publicHosted),
    },
    session: {
      authenticated,
      role: authenticated ? text(session.role, "member") : "anonymous",
      accessConfigured: Boolean(session.accessConfigured),
    },
    permissions: {
      canGenerate: Boolean(session.canGenerate),
      canUseServerCredentials: Boolean(session.canUseServerCredentials),
      canUseOwnerTools: Boolean(session.canUseOwnerTools || isOwner),
      canManageConnections: Boolean(session.canManageConnections || isOwner),
      canReadLocalFiles: Boolean(session.canReadLocalFiles && localProfile),
    },
    quotas: {
      enforced: Boolean(quotas.enforced),
      generationRemaining: Number.isFinite(quotas.generationRemaining)
        ? quotas.generationRemaining
        : null,
      storageBytesRemaining: Number.isFinite(quotas.storageBytesRemaining)
        ? quotas.storageBytesRemaining
        : null,
      reason: text(
        quotas.reason,
        quotas.enforced
          ? "Workspace usage limits apply to this session."
          : "SignalFlow billing quotas are not enabled for this deployment.",
      ),
    },
    capabilities: {
      accounts: capability(
        normalizedProfile === DEPLOYMENT_PROFILES.HOSTED && Boolean(cloud.accounts),
        normalizedProfile === DEPLOYMENT_PROFILES.HOSTED && cloud.accounts
          ? "Hosted accounts are available."
          : "Hosted account management is not enabled in this deployment.",
      ),
      workspaces: capability(
        normalizedProfile === DEPLOYMENT_PROFILES.HOSTED && Boolean(cloud.workspaces),
        normalizedProfile === DEPLOYMENT_PROFILES.HOSTED && cloud.workspaces
          ? "Cloud workspaces are available."
          : "Cloud workspace management is not enabled in this deployment.",
      ),
      persistence: {
        browserLocal: capability(true, "Campaigns can be saved in this browser."),
        cloudDatabase: capability(
          cloudDatabase,
          cloudDatabase
            ? "Campaign data can be saved to the hosted database."
            : "Cloud database persistence is not enabled; saved campaigns remain browser-local.",
        ),
        objectStorage: capability(
          objectStorage,
          objectStorage
            ? "Private cloud asset storage is available."
            : "Cloud asset storage is not enabled in this deployment.",
        ),
        backgroundJobs: capability(
          backgroundJobs,
          backgroundJobs
            ? "Durable background processing is available."
            : "Durable background processing is not enabled in this deployment.",
        ),
        autosave: capability(
          autosave,
          autosave
            ? "Cloud autosave is available."
            : "Cloud autosave is not enabled; use Save locally or export your campaign.",
        ),
        collaboration: capability(
          collaboration,
          collaboration
            ? "Workspace collaboration is available."
            : "Multi-user collaboration is not enabled in this deployment.",
        ),
      },
      transfer: {
        portableArchive: capability(
          true,
          "Versioned SignalFlow portable archives can be prepared and validated in this browser.",
          {
            schemaVersion: PORTABLE_TRANSFER_SCHEMA_VERSION,
            maxBrowserBytes: PORTABLE_TRANSFER_BROWSER_MAX_BYTES,
          },
        ),
        browserImportExport: capability(
          true,
          "This browser can prepare, download, validate, import, resume, and roll back portable archives.",
        ),
        hostedImport: capability(
          Boolean(transfer.hostedImport),
          transfer.hostedImport
            ? "A compatible hosted workspace transfer adapter is available to this session."
            : "Hosted workspace import is not enabled; the current transfer destination is this browser library.",
        ),
        signatures: capability(
          Boolean(transfer.signatures),
          transfer.signatures
            ? "Archive signing and verification are configured for this deployment."
            : "SHA-256 integrity is available; deployment archive signing is not configured.",
        ),
        silentSync: capability(
          false,
          "Portable transfer is explicit and user initiated; silent cross-deployment synchronization is not enabled.",
        ),
      },
      models: {
        managed: capability(
          Object.values(providerMap).some((provider) => provider.configured && provider.available),
          Object.values(providerMap).some((provider) => provider.configured && provider.available)
            ? "A server-managed model route is available to this session."
            : "No server-managed model route is available to this session.",
        ),
        byoKey: capability(
          Object.values(providerMap).some((provider) => provider.supportsTemporaryKey && provider.available),
          "Temporary bring-your-own provider keys are accepted only for the active request and are not saved.",
        ),
        customGateway: capability(
          Boolean(providerMap.custom?.available),
          providerMap.custom?.reason || "Custom gateways are unavailable in this session.",
        ),
        localEndpoints: capability(
          Boolean(providerMap.ollama?.available || providerMap.lmstudio?.available),
          providerMap.ollama?.available || providerMap.lmstudio?.available
            ? "Trusted local model endpoints can be configured in this session."
            : "Local model endpoints are unavailable in this session.",
        ),
        providers: providerMap,
      },
      sources: {
        brief: capability(true, "Written campaign briefs are supported."),
        publicLinks: capability(true, "Public link ingestion is supported with server-side safety checks."),
        browserFiles: capability(true, "Small text and code files can be extracted in the browser."),
        repositoryUrl: capability(true, "Public GitHub repository ingestion is supported."),
        localRepository: capability(
          Boolean(session.canReadLocalFiles && localProfile),
          session.canReadLocalFiles && localProfile
            ? "Trusted local repository paths are available in this deployment."
            : "Local filesystem repository paths are unavailable in this session.",
        ),
      },
      extension: {
        available: extensionBridgeReady,
        reason: text(
          extension.reason,
          extensionBridgeReady
            ? "The SignalFlow extension can deliver acknowledged captures to this deployment."
            : "Extension delivery is not ready because this deployment does not yet expose an acknowledged ingestion bridge.",
        ),
        protocol: {
          min: Number.isInteger(extension.protocolMin)
            ? extension.protocolMin
            : EXTENSION_PROTOCOL_VERSION,
          max: Number.isInteger(extension.protocolMax)
            ? extension.protocolMax
            : EXTENSION_PROTOCOL_VERSION,
        },
        captureTypes: {
          pageContext: Boolean(extensionBridgeReady && extension.pageContext),
          screenshot: Boolean(extensionBridgeReady && extension.screenshot),
          recording: Boolean(extensionBridgeReady && extension.recording),
        },
      },
      connectors: {
        official: connectorCapabilities,
        manualHandoff: capability(true, "Copy, export, and open-platform handoff remain available."),
      },
      exports: {
        markdown: capability(true, "Markdown campaign export is available."),
        json: capability(true, "JSON campaign export is available."),
        zip: capability(false, "Structured ZIP export is not enabled in the current product."),
      },
      scheduling: capability(false, "Durable scheduled publishing is not enabled in the current product."),
      mcp: capability(
        localProfile || Boolean(session.canUseOwnerTools),
        localProfile || session.canUseOwnerTools
          ? "The SignalFlow MCP server can use this deployment through an explicitly configured base URL and access context."
          : "MCP access is unavailable to this hosted session.",
      ),
      ownerTools: capability(
        Boolean(session.canUseOwnerTools || isOwner),
        session.canUseOwnerTools || isOwner
          ? "Owner-only administration tools are available."
          : "Owner-only administration tools are unavailable to this session.",
      ),
    },
  };
}

export function parseCapabilitySnapshot(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("SignalFlow returned an invalid capability document.");
  }
  if (value.schemaVersion !== CAPABILITY_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported SignalFlow capability schema: ${value.schemaVersion ?? "missing"}.`,
    );
  }
  if (value.product !== CAPABILITY_PRODUCT) {
    throw new Error("The capability document does not belong to SignalFlow Studio.");
  }

  const fallbackReason = "This capability was not declared by the connected SignalFlow deployment.";
  const persistence = value.capabilities?.persistence || {};
  const models = value.capabilities?.models || {};
  const sources = value.capabilities?.sources || {};
  const extension = value.capabilities?.extension || {};
  const exports = value.capabilities?.exports || {};
  const transfer = value.capabilities?.transfer || {};

  return {
    schemaVersion: CAPABILITY_SCHEMA_VERSION,
    product: CAPABILITY_PRODUCT,
    productVersion: text(value.productVersion, "0.0.0"),
    generatedAt: text(value.generatedAt),
    deployment: {
      profile: KNOWN_PROFILES.has(value.deployment?.profile)
        ? value.deployment.profile
        : DEPLOYMENT_PROFILES.LOCAL,
      publicHosted: Boolean(value.deployment?.publicHosted),
    },
    session: {
      authenticated: Boolean(value.session?.authenticated),
      role: text(value.session?.role, "anonymous"),
      accessConfigured: Boolean(value.session?.accessConfigured),
    },
    permissions: {
      canGenerate: Boolean(value.permissions?.canGenerate),
      canUseServerCredentials: Boolean(value.permissions?.canUseServerCredentials),
      canUseOwnerTools: Boolean(value.permissions?.canUseOwnerTools),
      canManageConnections: Boolean(value.permissions?.canManageConnections),
      canReadLocalFiles: Boolean(value.permissions?.canReadLocalFiles),
    },
    quotas: {
      enforced: Boolean(value.quotas?.enforced),
      generationRemaining: Number.isFinite(value.quotas?.generationRemaining)
        ? value.quotas.generationRemaining
        : null,
      storageBytesRemaining: Number.isFinite(value.quotas?.storageBytesRemaining)
        ? value.quotas.storageBytesRemaining
        : null,
      reason: text(value.quotas?.reason, fallbackReason),
    },
    capabilities: {
      accounts: normalizeCapability(value.capabilities?.accounts, fallbackReason),
      workspaces: normalizeCapability(value.capabilities?.workspaces, fallbackReason),
      persistence: {
        browserLocal: normalizeCapability(persistence.browserLocal, fallbackReason),
        cloudDatabase: normalizeCapability(persistence.cloudDatabase, fallbackReason),
        objectStorage: normalizeCapability(persistence.objectStorage, fallbackReason),
        backgroundJobs: normalizeCapability(persistence.backgroundJobs, fallbackReason),
        autosave: normalizeCapability(persistence.autosave, fallbackReason),
        collaboration: normalizeCapability(persistence.collaboration, fallbackReason),
      },
      transfer: {
        portableArchive: normalizeCapability(transfer.portableArchive, fallbackReason),
        browserImportExport: normalizeCapability(transfer.browserImportExport, fallbackReason),
        hostedImport: normalizeCapability(transfer.hostedImport, fallbackReason),
        signatures: normalizeCapability(transfer.signatures, fallbackReason),
        silentSync: normalizeCapability(transfer.silentSync, fallbackReason),
      },
      models: {
        managed: normalizeCapability(models.managed, fallbackReason),
        byoKey: normalizeCapability(models.byoKey, fallbackReason),
        customGateway: normalizeCapability(models.customGateway, fallbackReason),
        localEndpoints: normalizeCapability(models.localEndpoints, fallbackReason),
        providers: normalizeProviderMap(models.providers),
      },
      sources: {
        brief: normalizeCapability(sources.brief, fallbackReason),
        publicLinks: normalizeCapability(sources.publicLinks, fallbackReason),
        browserFiles: normalizeCapability(sources.browserFiles, fallbackReason),
        repositoryUrl: normalizeCapability(sources.repositoryUrl, fallbackReason),
        localRepository: normalizeCapability(sources.localRepository, fallbackReason),
      },
      extension: {
        available: Boolean(extension.available),
        reason: text(extension.reason, fallbackReason),
        protocol: {
          min: Number.isInteger(extension.protocol?.min) ? extension.protocol.min : null,
          max: Number.isInteger(extension.protocol?.max) ? extension.protocol.max : null,
        },
        captureTypes: {
          pageContext: Boolean(extension.captureTypes?.pageContext),
          screenshot: Boolean(extension.captureTypes?.screenshot),
          recording: Boolean(extension.captureTypes?.recording),
        },
      },
      connectors: {
        official: value.capabilities?.connectors?.official && typeof value.capabilities.connectors.official === "object"
          ? value.capabilities.connectors.official
          : {},
        manualHandoff: normalizeCapability(
          value.capabilities?.connectors?.manualHandoff,
          fallbackReason,
        ),
      },
      exports: {
        markdown: normalizeCapability(exports.markdown, fallbackReason),
        json: normalizeCapability(exports.json, fallbackReason),
        zip: normalizeCapability(exports.zip, fallbackReason),
      },
      scheduling: normalizeCapability(value.capabilities?.scheduling, fallbackReason),
      mcp: normalizeCapability(value.capabilities?.mcp, fallbackReason),
      ownerTools: normalizeCapability(value.capabilities?.ownerTools, fallbackReason),
    },
  };
}
