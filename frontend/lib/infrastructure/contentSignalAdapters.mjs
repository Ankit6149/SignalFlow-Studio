import { assertPort } from "../domain/ports.mjs";
import { portableClone, serializeDomainRecord } from "../domain/contracts.mjs";
import { normalizeContentSignal } from "../domain/contentSignals.mjs";

function clone(value) {
  return portableClone(value);
}

function sortSignals(items) {
  return [...items].sort((left, right) => {
    const dateOrder = String(right.updatedAt || right.observedAt || "").localeCompare(String(left.updatedAt || left.observedAt || ""));
    return dateOrder || String(left.signalId || "").localeCompare(String(right.signalId || ""));
  });
}

function assertSameOwner(existing, next) {
  if (existing && existing.workspaceId !== next.workspaceId) {
    throw new Error(`ContentSignal ${next.signalId} already belongs to another workspace.`);
  }
}

export function createMemoryContentSignalRepository(initial = []) {
  const records = new Map();
  for (const item of initial) {
    const signal = normalizeContentSignal(item);
    const existing = records.get(signal.signalId);
    assertSameOwner(existing, signal);
    records.set(signal.signalId, signal);
  }

  return assertPort("contentSignalRepository", {
    async list() {
      return sortSignals(Array.from(records.values())).map(clone);
    },
    async get(signalId) {
      return records.has(signalId) ? clone(records.get(signalId)) : null;
    },
    async upsert(input) {
      const signal = normalizeContentSignal(input);
      assertSameOwner(records.get(signal.signalId), signal);
      records.set(signal.signalId, signal);
      return clone(signal);
    },
    async remove(signalId) {
      return records.delete(signalId);
    },
  });
}

export function createBrowserContentSignalRepository({
  getStorage,
  key = "signalflow_content_signals_v1",
  limit = 250,
} = {}) {
  if (typeof getStorage !== "function") throw new TypeError("Browser signal repository requires getStorage().");

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
    if (!Array.isArray(parsed)) throw new TypeError("Stored ContentSignal data must be an array.");
    return parsed;
  }

  function write(items) {
    const normalized = sortSignals(items.map(normalizeContentSignal)).slice(0, limit);
    storage().setItem(key, `[${normalized.map((item) => serializeDomainRecord(item)).join(",")}]`);
    return normalized;
  }

  async function list() {
    const raw = readRaw();
    const normalized = raw.map(normalizeContentSignal);
    const serializedBefore = JSON.stringify(raw);
    const serializedAfter = JSON.stringify(normalized);
    const sorted = sortSignals(normalized).slice(0, limit);
    if (serializedBefore !== serializedAfter || raw.length !== sorted.length) write(sorted);
    return sorted.map(clone);
  }

  async function get(signalId) {
    const items = await list();
    return items.find((item) => item.signalId === signalId) || null;
  }

  async function upsert(input) {
    const signal = normalizeContentSignal(input);
    const items = await list();
    const existing = items.find((item) => item.signalId === signal.signalId);
    assertSameOwner(existing, signal);
    write([signal, ...items.filter((item) => item.signalId !== signal.signalId)]);
    return clone(signal);
  }

  async function remove(signalId) {
    const items = await list();
    const next = items.filter((item) => item.signalId !== signalId);
    write(next);
    return next.length !== items.length;
  }

  return assertPort("contentSignalRepository", { list, get, upsert, remove });
}

export function createStoreBackedContentSignalRepository({ store, prefix = "content-signal/" } = {}) {
  if (!store || ["list", "get", "set", "remove"].some((method) => typeof store[method] !== "function")) {
    throw new TypeError("Store-backed signal repository requires list/get/set/remove methods.");
  }
  const keyFor = (signalId) => `${prefix}${signalId}`;

  async function list() {
    const keys = await store.list(prefix);
    const signals = [];
    for (const key of keys) {
      const value = await store.get(key);
      if (!value) continue;
      const normalized = normalizeContentSignal(value);
      signals.push(normalized);
      if (JSON.stringify(value) !== JSON.stringify(normalized)) await store.set(key, normalized);
    }
    return sortSignals(signals).map(clone);
  }

  async function get(signalId) {
    const key = keyFor(signalId);
    const value = await store.get(key);
    if (!value) return null;
    const normalized = normalizeContentSignal(value);
    if (JSON.stringify(value) !== JSON.stringify(normalized)) await store.set(key, normalized);
    return clone(normalized);
  }

  async function upsert(input) {
    const signal = normalizeContentSignal(input);
    const existing = await get(signal.signalId);
    assertSameOwner(existing, signal);
    await store.set(keyFor(signal.signalId), signal);
    return clone(signal);
  }

  async function remove(signalId) {
    return Boolean(await store.remove(keyFor(signalId)));
  }

  return assertPort("contentSignalRepository", { list, get, upsert, remove });
}
