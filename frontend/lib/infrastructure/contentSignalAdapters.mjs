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

function externalEventKey({ workspaceId, provider, eventId } = {}) {
  const workspace = String(workspaceId || "").trim();
  const sourceProvider = String(provider || "").trim().toLowerCase();
  const sourceEventId = String(eventId || "").trim();
  if (!workspace || !sourceProvider || !sourceEventId) return null;
  return `${workspace}\u0000${sourceProvider}\u0000${sourceEventId}`;
}

function signalExternalEventKey(signal) {
  if (!signal?.externalEventRef) return null;
  return externalEventKey({
    workspaceId: signal.workspaceId,
    provider: signal.externalEventRef.provider,
    eventId: signal.externalEventRef.eventId,
  });
}

function findExternalSignal(items, query) {
  const target = externalEventKey(query);
  if (!target) return null;
  const match = items.find((item) => signalExternalEventKey(item) === target);
  return match ? clone(match) : null;
}

export function createMemoryContentSignalRepository(initial = []) {
  const records = new Map();
  const externalIndex = new Map();
  for (const item of initial) {
    const signal = normalizeContentSignal(item);
    const existing = records.get(signal.signalId);
    assertSameOwner(existing, signal);
    const eventKey = signalExternalEventKey(signal);
    if (eventKey && externalIndex.has(eventKey) && externalIndex.get(eventKey) !== signal.signalId) {
      throw new Error("Duplicate external ContentSignal event in repository seed data.");
    }
    records.set(signal.signalId, signal);
    if (eventKey) externalIndex.set(eventKey, signal.signalId);
  }

  async function list() {
    return sortSignals(Array.from(records.values())).map(clone);
  }

  async function get(signalId) {
    return records.has(signalId) ? clone(records.get(signalId)) : null;
  }

  async function upsert(input) {
    const signal = normalizeContentSignal(input);
    const existing = records.get(signal.signalId);
    assertSameOwner(existing, signal);
    const nextEventKey = signalExternalEventKey(signal);
    const existingByEvent = nextEventKey ? externalIndex.get(nextEventKey) : null;
    if (existingByEvent && existingByEvent !== signal.signalId) {
      throw new Error("Duplicate external ContentSignal event.");
    }
    const previousEventKey = signalExternalEventKey(existing);
    if (previousEventKey && previousEventKey !== nextEventKey) externalIndex.delete(previousEventKey);
    records.set(signal.signalId, signal);
    if (nextEventKey) externalIndex.set(nextEventKey, signal.signalId);
    return clone(signal);
  }

  async function remove(signalId) {
    const existing = records.get(signalId);
    const removed = records.delete(signalId);
    const eventKey = signalExternalEventKey(existing);
    if (removed && eventKey) externalIndex.delete(eventKey);
    return removed;
  }

  async function findByExternalEvent(query) {
    const key = externalEventKey(query);
    const signalId = key ? externalIndex.get(key) : null;
    return signalId ? get(signalId) : null;
  }

  async function insertExternalIfAbsent(input) {
    const signal = normalizeContentSignal(input);
    const eventKey = signalExternalEventKey(signal);
    if (!eventKey) throw new TypeError("insertExternalIfAbsent requires a connected ContentSignal externalEventRef.");
    const existingSignalId = externalIndex.get(eventKey);
    if (existingSignalId) return { signal: await get(existingSignalId), created: false };
    return { signal: await upsert(signal), created: true };
  }

  return assertPort("contentSignalRepository", {
    list,
    get,
    upsert,
    remove,
    findByExternalEvent,
    insertExternalIfAbsent,
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
    const eventKeys = new Set();
    for (const signal of normalized) {
      const eventKey = signalExternalEventKey(signal);
      if (!eventKey) continue;
      if (eventKeys.has(eventKey)) throw new Error("Duplicate external ContentSignal event in browser storage.");
      eventKeys.add(eventKey);
    }
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
    const duplicate = signalExternalEventKey(signal)
      ? items.find((item) => item.signalId !== signal.signalId && signalExternalEventKey(item) === signalExternalEventKey(signal))
      : null;
    if (duplicate) throw new Error("Duplicate external ContentSignal event.");
    write([signal, ...items.filter((item) => item.signalId !== signal.signalId)]);
    return clone(signal);
  }

  async function remove(signalId) {
    const items = await list();
    const next = items.filter((item) => item.signalId !== signalId);
    write(next);
    return next.length !== items.length;
  }

  async function findByExternalEvent(query) {
    return findExternalSignal(await list(), query);
  }

  async function insertExternalIfAbsent(input) {
    const signal = normalizeContentSignal(input);
    const query = signal.externalEventRef && {
      workspaceId: signal.workspaceId,
      provider: signal.externalEventRef.provider,
      eventId: signal.externalEventRef.eventId,
    };
    if (!query) throw new TypeError("insertExternalIfAbsent requires a connected ContentSignal externalEventRef.");
    const existing = await findByExternalEvent(query);
    if (existing) return { signal: existing, created: false };
    return { signal: await upsert(signal), created: true };
  }

  return assertPort("contentSignalRepository", {
    list,
    get,
    upsert,
    remove,
    findByExternalEvent,
    insertExternalIfAbsent,
  });
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
    const duplicate = signalExternalEventKey(signal)
      ? (await list()).find((item) => item.signalId !== signal.signalId && signalExternalEventKey(item) === signalExternalEventKey(signal))
      : null;
    if (duplicate) throw new Error("Duplicate external ContentSignal event.");
    await store.set(keyFor(signal.signalId), signal);
    return clone(signal);
  }

  async function remove(signalId) {
    return Boolean(await store.remove(keyFor(signalId)));
  }

  async function findByExternalEvent(query) {
    return findExternalSignal(await list(), query);
  }

  async function insertExternalIfAbsent(input) {
    const signal = normalizeContentSignal(input);
    const query = signal.externalEventRef && {
      workspaceId: signal.workspaceId,
      provider: signal.externalEventRef.provider,
      eventId: signal.externalEventRef.eventId,
    };
    if (!query) throw new TypeError("insertExternalIfAbsent requires a connected ContentSignal externalEventRef.");
    const existing = await findByExternalEvent(query);
    if (existing) return { signal: existing, created: false };
    return { signal: await upsert(signal), created: true };
  }

  return assertPort("contentSignalRepository", {
    list,
    get,
    upsert,
    remove,
    findByExternalEvent,
    insertExternalIfAbsent,
  });
}
