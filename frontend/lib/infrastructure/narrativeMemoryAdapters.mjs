import { assertPort } from "../domain/ports.mjs";
import { portableClone, serializeDomainRecord } from "../domain/contracts.mjs";
import { normalizeNarrativeMemory } from "../domain/narrativeMemory.mjs";

function clone(value) { return portableClone(value); }

function recordId(record) { return record.narrativeMemoryId; }

function sortRecords(items) {
  return [...items].sort((left, right) => String(right.updatedAt || right.createdAt).localeCompare(String(left.updatedAt || left.createdAt)) || recordId(left).localeCompare(recordId(right)));
}

function assertSameOwner(existing, next) {
  if (existing && existing.workspaceId !== next.workspaceId) {
    throw new Error(`NarrativeMemory ${next.narrativeMemoryId} already belongs to another workspace.`);
  }
}

export function createMemoryNarrativeMemoryRepository(initial = []) {
  const records = new Map();
  for (const input of initial) {
    const record = normalizeNarrativeMemory(input);
    records.set(recordId(record), record);
  }
  return assertPort("narrativeMemoryRepository", {
    async list() { return sortRecords([...records.values()]).map(clone); },
    async get(id) { return records.has(id) ? clone(records.get(id)) : null; },
    async upsert(input) {
      const record = normalizeNarrativeMemory(input);
      const key = recordId(record);
      assertSameOwner(records.get(key), record);
      records.set(key, record);
      return clone(record);
    },
    async remove(id) { return records.delete(id); },
  });
}

export function createBrowserNarrativeMemoryRepository({ getStorage, key = "signalflow_narrative_memory_v1", limit = 600 } = {}) {
  if (typeof getStorage !== "function") throw new TypeError("Browser NarrativeMemory repository requires getStorage().");
  function storage() {
    const target = getStorage();
    if (!target || typeof target.getItem !== "function" || typeof target.setItem !== "function") throw new TypeError("Browser storage is unavailable.");
    return target;
  }
  function readRaw() {
    const raw = storage().getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new TypeError("Stored NarrativeMemory data must be an array.");
    return parsed;
  }
  function write(items) {
    const normalized = sortRecords(items.map(normalizeNarrativeMemory)).slice(0, limit);
    storage().setItem(key, `[${normalized.map((item) => serializeDomainRecord(item)).join(",")}]`);
    return normalized;
  }
  async function list() {
    const raw = readRaw();
    const normalized = raw.map(normalizeNarrativeMemory);
    const sorted = sortRecords(normalized).slice(0, limit);
    if (JSON.stringify(raw) !== JSON.stringify(sorted)) write(sorted);
    return sorted.map(clone);
  }
  async function get(id) {
    const items = await list();
    return items.find((item) => recordId(item) === id) || null;
  }
  async function upsert(input) {
    const record = normalizeNarrativeMemory(input);
    const keyId = recordId(record);
    const items = await list();
    assertSameOwner(items.find((item) => recordId(item) === keyId), record);
    write([record, ...items.filter((item) => recordId(item) !== keyId)]);
    return clone(record);
  }
  async function remove(id) {
    const items = await list();
    const next = items.filter((item) => recordId(item) !== id);
    write(next);
    return next.length !== items.length;
  }
  return assertPort("narrativeMemoryRepository", { list, get, upsert, remove });
}

export function createStoreBackedNarrativeMemoryRepository({ store, prefix = "narrative-memory/" } = {}) {
  if (!store || ["list", "get", "set", "remove"].some((method) => typeof store[method] !== "function")) {
    throw new TypeError("Store-backed NarrativeMemory repository requires list/get/set/remove methods.");
  }
  const keyFor = (id) => `${prefix}${id}`;
  async function list() {
    const keys = await store.list(prefix);
    const result = [];
    for (const key of keys) {
      const value = await store.get(key);
      if (value) result.push(normalizeNarrativeMemory(value));
    }
    return sortRecords(result).map(clone);
  }
  async function get(id) {
    const value = await store.get(keyFor(id));
    return value ? clone(normalizeNarrativeMemory(value)) : null;
  }
  async function upsert(input) {
    const record = normalizeNarrativeMemory(input);
    const id = recordId(record);
    assertSameOwner(await get(id), record);
    await store.set(keyFor(id), record);
    return clone(record);
  }
  async function remove(id) { return Boolean(await store.remove(keyFor(id))); }
  return assertPort("narrativeMemoryRepository", { list, get, upsert, remove });
}
