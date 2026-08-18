import { assertPort } from "../domain/ports.mjs";
import { portableClone, serializeDomainRecord } from "../domain/contracts.mjs";
import { normalizeProjectContextSnapshot } from "../domain/projectContexts.mjs";

function clone(value) {
  return portableClone(value);
}

function sortContexts(items) {
  return [...items].sort((left, right) => {
    const projectOrder = String(left.projectId).localeCompare(String(right.projectId));
    if (projectOrder) return projectOrder;
    const versionOrder = Number(right.version || 0) - Number(left.version || 0);
    if (versionOrder) return versionOrder;
    return String(right.createdAt || "").localeCompare(String(left.createdAt || ""));
  });
}

function assertSameOwner(existing, next) {
  if (!existing) return;
  if (existing.workspaceId !== next.workspaceId || existing.projectId !== next.projectId) {
    throw new Error(`ProjectContextSnapshot ${next.projectContextSnapshotId} cannot be reassigned to another workspace/project.`);
  }
}

export function createMemoryProjectContextRepository(initial = []) {
  const records = new Map();
  for (const input of initial) {
    const context = normalizeProjectContextSnapshot(input);
    assertSameOwner(records.get(context.projectContextSnapshotId), context);
    records.set(context.projectContextSnapshotId, context);
  }

  return assertPort("projectContextRepository", {
    async list() {
      return sortContexts(Array.from(records.values())).map(clone);
    },
    async get(projectContextSnapshotId) {
      return records.has(projectContextSnapshotId) ? clone(records.get(projectContextSnapshotId)) : null;
    },
    async upsert(input) {
      const context = normalizeProjectContextSnapshot(input);
      assertSameOwner(records.get(context.projectContextSnapshotId), context);
      records.set(context.projectContextSnapshotId, context);
      return clone(context);
    },
    async remove(projectContextSnapshotId) {
      return records.delete(projectContextSnapshotId);
    },
  });
}

export function createBrowserProjectContextRepository({
  getStorage,
  key = "signalflow_project_contexts_v1",
  limit = 500,
} = {}) {
  if (typeof getStorage !== "function") throw new TypeError("Browser project-context repository requires getStorage().");

  function storage() {
    const target = getStorage();
    if (!target || typeof target.getItem !== "function" || typeof target.setItem !== "function") {
      throw new TypeError("Browser storage is unavailable.");
    }
    return target;
  }

  function readRaw() {
    const raw = storage().getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new TypeError("Stored ProjectContextSnapshot data must be an array.");
    return parsed;
  }

  function write(items) {
    const normalized = sortContexts(items.map(normalizeProjectContextSnapshot)).slice(0, limit);
    storage().setItem(key, `[${normalized.map((item) => serializeDomainRecord(item)).join(",")}]`);
    return normalized;
  }

  async function list() {
    const raw = readRaw();
    const normalized = raw.map(normalizeProjectContextSnapshot);
    const sorted = sortContexts(normalized).slice(0, limit);
    if (JSON.stringify(raw) !== JSON.stringify(sorted)) write(sorted);
    return sorted.map(clone);
  }

  async function get(projectContextSnapshotId) {
    const items = await list();
    return items.find((item) => item.projectContextSnapshotId === projectContextSnapshotId) || null;
  }

  async function upsert(input) {
    const context = normalizeProjectContextSnapshot(input);
    const items = await list();
    const existing = items.find((item) => item.projectContextSnapshotId === context.projectContextSnapshotId);
    assertSameOwner(existing, context);
    write([context, ...items.filter((item) => item.projectContextSnapshotId !== context.projectContextSnapshotId)]);
    return clone(context);
  }

  async function remove(projectContextSnapshotId) {
    const items = await list();
    const next = items.filter((item) => item.projectContextSnapshotId !== projectContextSnapshotId);
    write(next);
    return next.length !== items.length;
  }

  return assertPort("projectContextRepository", { list, get, upsert, remove });
}

export function createStoreBackedProjectContextRepository({ store, prefix = "project-context/" } = {}) {
  if (!store || ["list", "get", "set", "remove"].some((method) => typeof store[method] !== "function")) {
    throw new TypeError("Store-backed project-context repository requires list/get/set/remove methods.");
  }

  const keyFor = (projectContextSnapshotId) => `${prefix}${projectContextSnapshotId}`;

  async function list() {
    const keys = await store.list(prefix);
    const result = [];
    for (const key of keys) {
      const value = await store.get(key);
      if (!value) continue;
      const normalized = normalizeProjectContextSnapshot(value);
      result.push(normalized);
      if (JSON.stringify(value) !== JSON.stringify(normalized)) await store.set(key, normalized);
    }
    return sortContexts(result).map(clone);
  }

  async function get(projectContextSnapshotId) {
    const key = keyFor(projectContextSnapshotId);
    const value = await store.get(key);
    if (!value) return null;
    const normalized = normalizeProjectContextSnapshot(value);
    if (JSON.stringify(value) !== JSON.stringify(normalized)) await store.set(key, normalized);
    return clone(normalized);
  }

  async function upsert(input) {
    const context = normalizeProjectContextSnapshot(input);
    assertSameOwner(await get(context.projectContextSnapshotId), context);
    await store.set(keyFor(context.projectContextSnapshotId), context);
    return clone(context);
  }

  async function remove(projectContextSnapshotId) {
    return Boolean(await store.remove(keyFor(projectContextSnapshotId)));
  }

  return assertPort("projectContextRepository", { list, get, upsert, remove });
}
