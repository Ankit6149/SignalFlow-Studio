import { assertPort } from "../domain/ports.mjs";
import { portableClone, serializeDomainRecord } from "../domain/contracts.mjs";
import {
  normalizePlatformVariantApproval,
  normalizePlatformVariantReview,
} from "../domain/platformVariantReviews.mjs";

const SUPPORTED = new Set(["PlatformVariantReview", "PlatformVariantApproval"]);

function clone(value) { return portableClone(value); }

function normalize(input) {
  if (!input || typeof input !== "object") throw new TypeError("Content review repository requires a record.");
  if (!SUPPORTED.has(input.kind)) throw new TypeError(`Unsupported content review record: ${input.kind || "missing"}.`);
  return input.kind === "PlatformVariantReview"
    ? normalizePlatformVariantReview(input)
    : normalizePlatformVariantApproval(input);
}

function recordId(record) {
  if (record.kind === "PlatformVariantReview") return record.platformVariantReviewId;
  if (record.kind === "PlatformVariantApproval") return record.platformVariantApprovalId;
  throw new TypeError(`Unsupported content review record: ${record.kind || "missing"}.`);
}

function time(record) {
  return record.decidedAt || record.createdAt || "";
}

function sortRecords(items) {
  return [...items].sort((a, b) => String(time(b)).localeCompare(String(time(a))) || recordId(a).localeCompare(recordId(b)));
}

function assertSameOwner(existing, next) {
  if (existing && existing.workspaceId !== next.workspaceId) throw new Error(`${next.kind} ${recordId(next)} already belongs to another workspace.`);
}

export function createMemoryContentReviewRepository(initial = []) {
  const records = new Map();
  for (const input of initial) {
    const record = normalize(input);
    records.set(recordId(record), record);
  }
  return assertPort("contentReviewRepository", {
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

export function createBrowserContentReviewRepository({ getStorage, key = "signalflow_content_reviews_v1", limit = 800 } = {}) {
  if (typeof getStorage !== "function") throw new TypeError("Browser content review repository requires getStorage().");
  function storage() {
    const target = getStorage();
    if (!target || typeof target.getItem !== "function" || typeof target.setItem !== "function") throw new TypeError("Browser storage is unavailable.");
    return target;
  }
  function readRaw() {
    const raw = storage().getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new TypeError("Stored content review data must be an array.");
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
  return assertPort("contentReviewRepository", { list, get, upsert, remove });
}

export function createStoreBackedContentReviewRepository({ store, prefix = "content-review/" } = {}) {
  if (!store || ["list", "get", "set", "remove"].some((method) => typeof store[method] !== "function")) {
    throw new TypeError("Store-backed content review repository requires list/get/set/remove methods.");
  }
  const keyFor = (id) => `${prefix}${id}`;
  async function list() {
    const keys = await store.list(prefix);
    const result = [];
    for (const key of keys) {
      const value = await store.get(key);
      if (!value) continue;
      result.push(normalize(value));
    }
    return sortRecords(result).map(clone);
  }
  async function get(id) {
    const value = await store.get(keyFor(id));
    return value ? clone(normalize(value)) : null;
  }
  async function upsert(input) {
    const record = normalize(input);
    const id = recordId(record);
    assertSameOwner(await get(id), record);
    await store.set(keyFor(id), record);
    return clone(record);
  }
  async function remove(id) { return Boolean(await store.remove(keyFor(id))); }
  return assertPort("contentReviewRepository", { list, get, upsert, remove });
}
