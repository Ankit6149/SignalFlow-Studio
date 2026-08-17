import { assertPort } from "../domain/ports.mjs";
import { portableClone, serializeDomainRecord } from "../domain/contracts.mjs";
import {
  normalizeContentPiece,
  normalizeNarrativeStrategy,
  normalizePlatformVariant,
} from "../domain/contentPlanning.mjs";

const SUPPORTED = new Set(["NarrativeStrategy", "ContentPiece", "PlatformVariant"]);

function clone(value) { return portableClone(value); }

function normalize(input) {
  if (!input || typeof input !== "object") throw new TypeError("Content planning repository requires a record.");
  if (!SUPPORTED.has(input.kind)) throw new TypeError(`Unsupported content planning record: ${input.kind || "missing"}.`);
  if (input.kind === "NarrativeStrategy") return normalizeNarrativeStrategy(input);
  if (input.kind === "ContentPiece") return normalizeContentPiece(input);
  return normalizePlatformVariant(input);
}

function recordId(record) {
  return record.narrativeStrategyId || record.contentPieceId || record.platformVariantId;
}

function sortRecords(items) {
  return [...items].sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")) || recordId(a).localeCompare(recordId(b)));
}

function assertSameOwner(existing, next) {
  if (existing && existing.workspaceId !== next.workspaceId) throw new Error(`${next.kind} ${recordId(next)} already belongs to another workspace.`);
}

export function createMemoryContentPlanningRepository(initial = []) {
  const records = new Map();
  for (const input of initial) {
    const record = normalize(input);
    const key = recordId(record);
    assertSameOwner(records.get(key), record);
    records.set(key, record);
  }
  return assertPort("contentPlanningRepository", {
    async list() { return sortRecords([...records.values()]).map(clone); },
    async get(id) { return records.has(id) ? clone(records.get(id)) : null; },
    async upsert(input) {
      const record = normalize(input);
      const key = recordId(record);
      assertSameOwner(records.get(key), record);
      records.set(key, record);
      return clone(record);
    },
    async remove(id) { return records.delete(id); },
  });
}

export function createBrowserContentPlanningRepository({ getStorage, key = "signalflow_content_planning_v1", limit = 600 } = {}) {
  if (typeof getStorage !== "function") throw new TypeError("Browser content planning repository requires getStorage().");
  function storage() {
    const target = getStorage();
    if (!target || typeof target.getItem !== "function" || typeof target.setItem !== "function") throw new TypeError("Browser storage is unavailable.");
    return target;
  }
  function readRaw() {
    const raw = storage().getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new TypeError("Stored content planning data must be an array.");
    return parsed;
  }
  function write(items) {
    const normalized = sortRecords(items.map(normalize)).slice(0, limit);
    storage().setItem(key, `[${normalized.map((item) => serializeDomainRecord(item)).join(",")}]`);
    return normalized;
  }
  async function list() {
    const raw = readRaw();
    const normalized = raw.map(normalize);
    const sorted = sortRecords(normalized).slice(0, limit);
    if (JSON.stringify(raw) !== JSON.stringify(sorted)) write(sorted);
    return sorted.map(clone);
  }
  async function get(id) {
    const items = await list();
    return items.find((item) => recordId(item) === id) || null;
  }
  async function upsert(input) {
    const record = normalize(input);
    const id = recordId(record);
    const items = await list();
    assertSameOwner(items.find((item) => recordId(item) === id), record);
    write([record, ...items.filter((item) => recordId(item) !== id)]);
    return clone(record);
  }
  async function remove(id) {
    const items = await list();
    const next = items.filter((item) => recordId(item) !== id);
    write(next);
    return next.length !== items.length;
  }
  return assertPort("contentPlanningRepository", { list, get, upsert, remove });
}

export function createStoreBackedContentPlanningRepository({ store, prefix = "content-plan/" } = {}) {
  if (!store || ["list", "get", "set", "remove"].some((method) => typeof store[method] !== "function")) throw new TypeError("Store-backed content planning repository requires list/get/set/remove methods.");
  const keyFor = (id) => `${prefix}${id}`;
  async function list() {
    const keys = await store.list(prefix);
    const result = [];
    for (const key of keys) {
      const value = await store.get(key);
      if (!value) continue;
      const record = normalize(value);
      result.push(record);
      if (JSON.stringify(value) !== JSON.stringify(record)) await store.set(key, record);
    }
    return sortRecords(result).map(clone);
  }
  async function get(id) {
    const value = await store.get(keyFor(id));
    if (!value) return null;
    const record = normalize(value);
    if (JSON.stringify(value) !== JSON.stringify(record)) await store.set(keyFor(id), record);
    return clone(record);
  }
  async function upsert(input) {
    const record = normalize(input);
    const id = recordId(record);
    assertSameOwner(await get(id), record);
    await store.set(keyFor(id), record);
    return clone(record);
  }
  async function remove(id) { return Boolean(await store.remove(keyFor(id))); }
  return assertPort("contentPlanningRepository", { list, get, upsert, remove });
}
