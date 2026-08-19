import { assertPort } from "../domain/ports.mjs";
import { portableClone } from "../domain/contracts.mjs";
import { normalizeSourceConnection } from "../domain/sourceConnections.mjs";

function clone(value) {
  return portableClone(value);
}

function sortConnections(items) {
  return [...items].sort((left, right) => {
    const dateOrder = String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""));
    return dateOrder || String(left.sourceConnectionId).localeCompare(String(right.sourceConnectionId));
  });
}

function assertSameOwner(existing, next) {
  if (existing && existing.workspaceId !== next.workspaceId) {
    throw new Error(`SourceConnection ${next.sourceConnectionId} already belongs to another workspace.`);
  }
}

function normalizeInstallationLookup(provider, installationRef) {
  return {
    provider: String(provider || "").trim().toLowerCase(),
    installationRef: String(installationRef || "").trim(),
  };
}

function matchesInstallation(connection, lookup) {
  return Boolean(
    lookup.provider
    && lookup.installationRef
    && connection.provider === lookup.provider
    && connection.installationRef === lookup.installationRef
  );
}

export function createMemorySourceConnectionRepository(initial = []) {
  const records = new Map();
  for (const item of initial) {
    const connection = normalizeSourceConnection(item);
    assertSameOwner(records.get(connection.sourceConnectionId), connection);
    records.set(connection.sourceConnectionId, connection);
  }

  return assertPort("sourceConnectionRepository", {
    async list() {
      return sortConnections(Array.from(records.values())).map(clone);
    },
    async get(sourceConnectionId) {
      return records.has(sourceConnectionId) ? clone(records.get(sourceConnectionId)) : null;
    },
    async upsert(input) {
      const connection = normalizeSourceConnection(input);
      assertSameOwner(records.get(connection.sourceConnectionId), connection);
      records.set(connection.sourceConnectionId, connection);
      return clone(connection);
    },
    async remove(sourceConnectionId) {
      return records.delete(sourceConnectionId);
    },
    async findByProviderInstallation(provider, installationRef) {
      const lookup = normalizeInstallationLookup(provider, installationRef);
      if (!lookup.provider || !lookup.installationRef) return [];
      return sortConnections(
        Array.from(records.values()).filter((connection) => matchesInstallation(connection, lookup)),
      ).map(clone);
    },
  });
}

export function createStoreBackedSourceConnectionRepository({ store, prefix = "source-connection/" } = {}) {
  if (!store || ["list", "get", "set", "remove"].some((method) => typeof store[method] !== "function")) {
    throw new TypeError("Store-backed source connection repository requires list/get/set/remove methods.");
  }
  const keyFor = (sourceConnectionId) => `${prefix}${sourceConnectionId}`;

  async function list() {
    const keys = await store.list(prefix);
    const items = [];
    for (const key of keys) {
      const value = await store.get(key);
      if (!value) continue;
      items.push(normalizeSourceConnection(value));
    }
    return sortConnections(items).map(clone);
  }

  async function get(sourceConnectionId) {
    const value = await store.get(keyFor(sourceConnectionId));
    return value ? clone(normalizeSourceConnection(value)) : null;
  }

  async function upsert(input) {
    const connection = normalizeSourceConnection(input);
    const existing = await get(connection.sourceConnectionId);
    assertSameOwner(existing, connection);
    await store.set(keyFor(connection.sourceConnectionId), connection);
    return clone(connection);
  }

  async function remove(sourceConnectionId) {
    return Boolean(await store.remove(keyFor(sourceConnectionId)));
  }

  async function findByProviderInstallation(provider, installationRef) {
    const lookup = normalizeInstallationLookup(provider, installationRef);
    if (!lookup.provider || !lookup.installationRef) return [];
    return (await list()).filter((connection) => matchesInstallation(connection, lookup));
  }

  return assertPort("sourceConnectionRepository", {
    list,
    get,
    upsert,
    remove,
    findByProviderInstallation,
  });
}
