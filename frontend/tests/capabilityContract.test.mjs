import test from "node:test";
import assert from "node:assert/strict";

import {
  CAPABILITY_SCHEMA_VERSION,
  createCapabilitySnapshot,
  DEPLOYMENT_PROFILES,
  parseCapabilitySnapshot,
} from "../lib/capabilities/capabilityContract.mjs";

const baseProviders = {
  gemini: {
    label: "Gemini",
    available: true,
    configured: false,
    supportsTemporaryKey: true,
  },
  custom: {
    label: "Custom gateway",
    available: false,
    configured: false,
    supportsTemporaryKey: true,
    reason: "Owner-only in hosted mode.",
  },
  ollama: {
    label: "Ollama",
    available: false,
    configured: false,
    isLocal: true,
    reason: "Unavailable to this hosted session.",
  },
};

test("hosted anonymous capability snapshot exposes BYOK but not owner or local routes", () => {
  const snapshot = createCapabilitySnapshot({
    profile: DEPLOYMENT_PROFILES.HOSTED,
    publicHosted: true,
    session: {
      authenticated: false,
      role: "anonymous",
      canGenerate: true,
      canUseServerCredentials: false,
      canUseOwnerTools: false,
      canReadLocalFiles: false,
    },
    providers: baseProviders,
  });

  assert.equal(snapshot.deployment.profile, "hosted");
  assert.equal(snapshot.session.role, "anonymous");
  assert.equal(snapshot.capabilities.models.byoKey.available, true);
  assert.equal(snapshot.capabilities.models.customGateway.available, false);
  assert.equal(snapshot.capabilities.models.localEndpoints.available, false);
  assert.equal(snapshot.capabilities.sources.localRepository.available, false);
  assert.equal(snapshot.capabilities.ownerTools.available, false);
});

test("hosted member contract remains non-owner and cloud features reflect configuration", () => {
  const snapshot = createCapabilitySnapshot({
    profile: DEPLOYMENT_PROFILES.HOSTED,
    publicHosted: true,
    session: {
      authenticated: true,
      role: "member",
      canGenerate: true,
    },
    providers: baseProviders,
    cloud: {
      accounts: true,
      workspaces: true,
      database: true,
      objectStorage: true,
      backgroundJobs: true,
      autosave: true,
      collaboration: false,
    },
  });

  assert.equal(snapshot.session.authenticated, true);
  assert.equal(snapshot.session.role, "member");
  assert.equal(snapshot.capabilities.accounts.available, true);
  assert.equal(snapshot.capabilities.persistence.cloudDatabase.available, true);
  assert.equal(snapshot.capabilities.persistence.autosave.available, true);
  assert.equal(snapshot.capabilities.persistence.collaboration.available, false);
  assert.equal(snapshot.capabilities.ownerTools.available, false);
});

test("hosted owner can use declared owner and configured server routes", () => {
  const providers = structuredClone(baseProviders);
  providers.custom.available = true;
  providers.custom.configured = true;
  providers.ollama.available = true;
  providers.ollama.requiresBaseUrl = true;

  const snapshot = createCapabilitySnapshot({
    profile: DEPLOYMENT_PROFILES.HOSTED,
    publicHosted: true,
    session: {
      authenticated: true,
      role: "owner",
      canGenerate: true,
      canUseServerCredentials: true,
      canUseOwnerTools: true,
      canManageConnections: true,
    },
    providers,
  });

  assert.equal(snapshot.capabilities.ownerTools.available, true);
  assert.equal(snapshot.permissions.canUseServerCredentials, true);
  assert.equal(snapshot.capabilities.models.customGateway.available, true);
  assert.equal(snapshot.capabilities.models.localEndpoints.available, true);
});

test("local and self-hosted profiles never imply cloud storage or collaboration", () => {
  for (const profile of [DEPLOYMENT_PROFILES.LOCAL, DEPLOYMENT_PROFILES.SELF_HOSTED]) {
    const snapshot = createCapabilitySnapshot({
      profile,
      session: {
        authenticated: true,
        role: "owner",
        canGenerate: true,
        canUseOwnerTools: true,
        canReadLocalFiles: true,
      },
      providers: {
        ollama: {
          label: "Ollama",
          available: true,
          configured: true,
          isLocal: true,
        },
      },
    });

    assert.equal(snapshot.capabilities.persistence.browserLocal.available, true);
    assert.equal(snapshot.capabilities.persistence.cloudDatabase.available, false);
    assert.equal(snapshot.capabilities.persistence.objectStorage.available, false);
    assert.equal(snapshot.capabilities.persistence.collaboration.available, false);
    assert.equal(snapshot.capabilities.sources.localRepository.available, true);
    assert.equal(snapshot.capabilities.mcp.available, true);
  }
});

test("current extension contract fails closed until acknowledged ingestion exists", () => {
  const snapshot = createCapabilitySnapshot({
    extension: {
      bridgeReady: false,
      pageContext: true,
      screenshot: true,
      recording: true,
    },
  });

  assert.equal(snapshot.capabilities.extension.available, false);
  assert.deepEqual(snapshot.capabilities.extension.captureTypes, {
    pageContext: false,
    screenshot: false,
    recording: false,
  });
});

test("client parser ignores unknown future fields and keeps known capability data", () => {
  const raw = createCapabilitySnapshot({ providers: baseProviders });
  raw.futureRoot = { anything: true };
  raw.capabilities.futureCapability = { available: true };
  raw.capabilities.models.providers.gemini.futureProviderField = "ignored";

  const parsed = parseCapabilitySnapshot(raw);
  assert.equal(parsed.schemaVersion, CAPABILITY_SCHEMA_VERSION);
  assert.equal(parsed.futureRoot, undefined);
  assert.equal(parsed.capabilities.futureCapability, undefined);
  assert.equal(parsed.capabilities.models.providers.gemini.futureProviderField, undefined);
  assert.equal(parsed.capabilities.models.providers.gemini.supportsTemporaryKey, true);
});

test("missing known capability fields degrade safely to unavailable", () => {
  const raw = createCapabilitySnapshot();
  delete raw.capabilities.exports.markdown;
  delete raw.capabilities.persistence.cloudDatabase;

  const parsed = parseCapabilitySnapshot(raw);
  assert.equal(parsed.capabilities.exports.markdown.available, false);
  assert.equal(parsed.capabilities.persistence.cloudDatabase.available, false);
  assert.match(parsed.capabilities.exports.markdown.reason, /not declared/i);
});

test("unsupported capability schema versions are rejected", () => {
  const raw = createCapabilitySnapshot();
  raw.schemaVersion = CAPABILITY_SCHEMA_VERSION + 1;
  assert.throws(() => parseCapabilitySnapshot(raw), /unsupported signalflow capability schema/i);
});
