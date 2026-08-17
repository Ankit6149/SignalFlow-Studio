import { assertPort } from "../domain/ports.mjs";
import { portableClone, serializeDomainRecord } from "../domain/contracts.mjs";
import { normalizeFeedbackEvent, normalizeStyleMemoryHypothesis } from "../domain/styleMemory.mjs";

function clone(value) { return portableClone(value); }

function normalizeRecord(input) {
  if (input?.kind === "FeedbackEvent") return normalizeFeedbackEvent(input);
  if (input?.kind === "StyleMemoryHypothesis") return normalizeStyleMemoryHypothesis(input);
  throw new TypeError(`Unsupported StyleMemory repository record: ${input?.kind || "missing"}.`);
}

function recordId(record) {
  return record.kind === "FeedbackEvent" ? record.feedbackEventId : record.styleMemoryId;
}

function sortRecords(items) {
  return [...items].sort((left, right) => String(right.updatedAt || right.createdAt).localeCompare(String(left.updatedAt || left.createdAt)) || recordId(left).localeCompare(recordId(right)));
}

function assertSameOwner(existing, next) {
  if (!existing) return;
  if (existing.workspaceId !== next.workspaceId || existing.userId !== next.userId) {
    throw new Error(`${next.kind} ${recordId(next)} already belongs to another owner/workspace.`);
  }
}

export function createMemoryStyleMemoryRepository(initial = []) {
  const records = new Map();
  for (const input of initial) {
    const record = normalizeRecord(input);
    records.set(recordId(record), record);
  }
  return assertPort("styleMemoryRepository", {
    async list() { return sortRecords([...records.values()]).map(clone); },
    async get(id) { return records.has(id) ? clone(records.get(id)) : null; },
    async upsert(input) {
      const record = normalizeRecord(input);
      const key = recordId(record);
      assertSameOwner(records.get(key), record);
      records.set(key, record);
      return clone(record);
    },
    async remove(id) { return records.delete(id); },
  });
}

export function createBrowserStyleMemoryRepository({ getStorage, key = "signalflow_style_memory_v1", limit = 1200 } = {}) {
  if (typeof getStorage !== "function") throw new TypeError("Browser StyleMemory repository requires getStorage().");
  function storage() {
    const target = getStorage();
    if (!target || typeof target.getItem !== "function" || typeof target.setItem !== "function") throw new TypeError("Browser storage is unavailable.");
    return target;
  }
  function readRaw() {
    const raw = storage().getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new TypeError("Stored StyleMemory data must be an array.");
    return parsed;
  }
  function write(items) {
    const normalized = sortRecords(items.map(normalizeRecord)).slice(0, limit);
    storage().setItem(key, `[${normalized.map((item) => serializeDomainRecord(item)).join(",")}]`);
    return normalized;
  }
  async function list() {
    const raw = readRaw();
    const normalized = raw.map(normalizeRecord);
    const sorted = sortRecords(normalized).slice(0, limit);
    if (JSON.stringify(raw) !== JSON.stringify(sorted)) write(sorted);
    return sorted.map(clone);
  }
  async function get(id) {
    const items = await list();
    return items.find((item) => recordId(item) === id) || null;
  }
  async function upsert(input) {
    const record = normalizeRecord(input);
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
  return assertPort("styleMemoryRepository", { list, get, upsert, remove });
}

export function createStoreBackedStyleMemoryRepository({ store, prefix = "style-memory/" } = {}) {
  if (!store || ["list", "get", "set", "remove"].some((method) => typeof store[method] !== "function")) {
    throw new TypeError("Store-backed StyleMemory repository requires list/get/set/remove methods.");
  }
  const keyFor = (id) => `${prefix}${id}`;
  async function list() {
    const keys = await store.list(prefix);
    const result = [];
    for (const key of keys) {
      const value = await store.get(key);
      if (value) result.push(normalizeRecord(value));
    }
    return sortRecords(result).map(clone);
  }
  async function get(id) {
    const value = await store.get(keyFor(id));
    return value ? clone(normalizeRecord(value)) : null;
  }
  async function upsert(input) {
    const record = normalizeRecord(input);
    const id = recordId(record);
    assertSameOwner(await get(id), record);
    await store.set(keyFor(id), record);
    return clone(record);
  }
  async function remove(id) { return Boolean(await store.remove(keyFor(id))); }
  return assertPort("styleMemoryRepository", { list, get, upsert, remove });
}
