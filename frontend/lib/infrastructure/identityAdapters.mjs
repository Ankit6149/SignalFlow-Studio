import { assertPort } from "../domain/ports.mjs";
import { portableClone, serializeDomainRecord } from "../domain/contracts.mjs";
import { normalizeIdentityRecord } from "../domain/identityProfiles.mjs";

function clone(value) { return portableClone(value); }

function sortRecords(records) {
  return [...records].sort((left, right) => {
    const kindOrder = String(left.kind).localeCompare(String(right.kind));
    if (kindOrder) return kindOrder;
    const versionOrder = Number(right.version || 0) - Number(left.version || 0);
    if (versionOrder) return versionOrder;
    return String(right.createdAt || "").localeCompare(String(left.createdAt || ""));
  });
}

function recordId(record) {
  const candidates = [
    record.identityProfileId,
    record.perceptionProfileId,
    record.voiceProfileId,
    record.boundaryProfileId,
    record.platformExpressionProfileId,
    record.projectGuidanceProfileId,
    record.identityContextSnapshotId,
  ].filter(Boolean);
  if (candidates.length !== 1) throw new TypeError(`${record.kind || "Identity record"} must have exactly one identity record ID.`);
  return candidates[0];
}

function assertSameOwner(existing, next) {
  if (existing && existing.workspaceId !== next.workspaceId) throw new Error(`Identity record ${recordId(next)} already belongs to another workspace.`);
}

export function createMemoryIdentityRepository(initial = []) {
  const records = new Map();
  for (const input of initial) {
    const record = normalizeIdentityRecord(input);
    const id = recordId(record);
    assertSameOwner(records.get(id), record);
    records.set(id, record);
  }
  return assertPort("identityRepository", {
    async list() { return sortRecords(Array.from(records.values())).map(clone); },
    async get(id) { return records.has(id) ? clone(records.get(id)) : null; },
    async upsert(input) {
      const record = normalizeIdentityRecord(input);
      const id = recordId(record);
      assertSameOwner(records.get(id), record);
      records.set(id, record);
      return clone(record);
    },
    async remove(id) { return records.delete(id); },
  });
}

export function createBrowserIdentityRepository({ getStorage, key = "signalflow_identity_profiles_v1", limit = 600 } = {}) {
  if (typeof getStorage !== "function") throw new TypeError("Browser identity repository requires getStorage().");
  function storage() {
    const target = getStorage();
    if (!target || typeof target.getItem !== "function" || typeof target.setItem !== "function") throw new TypeError("Browser storage is unavailable.");
    return target;
  }
  function readRaw() {
    const raw = storage().getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new TypeError("Stored identity data must be an array.");
    return parsed;
  }
  function write(items) {
    const normalized = sortRecords(items.map(normalizeIdentityRecord)).slice(0, limit);
    storage().setItem(key, `[${normalized.map((item) => serializeDomainRecord(item)).join(",")}]`);
    return normalized;
  }
  async function list() {
    const raw = readRaw();
    const normalized = raw.map(normalizeIdentityRecord);
    const sorted = sortRecords(normalized).slice(0, limit);
    if (JSON.stringify(raw) !== JSON.stringify(sorted)) write(sorted);
    return sorted.map(clone);
  }
  async function get(id) {
    const items = await list();
    return items.find((item) => recordId(item) === id) || null;
  }
  async function upsert(input) {
    const record = normalizeIdentityRecord(input);
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
  return assertPort("identityRepository", { list, get, upsert, remove });
}

export function createStoreBackedIdentityRepository({ store, prefix = "identity/" } = {}) {
  if (!store || ["list", "get", "set", "remove"].some((method) => typeof store[method] !== "function")) {
    throw new TypeError("Store-backed identity repository requires list/get/set/remove methods.");
  }
  const keyFor = (id) => `${prefix}${id}`;
  async function list() {
    const keys = await store.list(prefix);
    const result = [];
    for (const key of keys) {
      const value = await store.get(key);
      if (!value) continue;
      const normalized = normalizeIdentityRecord(value);
      result.push(normalized);
      if (JSON.stringify(value) !== JSON.stringify(normalized)) await store.set(key, normalized);
    }
    return sortRecords(result).map(clone);
  }
  async function get(id) {
    const value = await store.get(keyFor(id));
    if (!value) return null;
    const normalized = normalizeIdentityRecord(value);
    if (JSON.stringify(value) !== JSON.stringify(normalized)) await store.set(keyFor(id), normalized);
    return clone(normalized);
  }
  async function upsert(input) {
    const record = normalizeIdentityRecord(input);
    const id = recordId(record);
    assertSameOwner(await get(id), record);
    await store.set(keyFor(id), record);
    return clone(record);
  }
  async function remove(id) { return Boolean(await store.remove(keyFor(id))); }
  return assertPort("identityRepository", { list, get, upsert, remove });
}
