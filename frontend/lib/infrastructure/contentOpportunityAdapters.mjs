import { assertPort } from "../domain/ports.mjs";
import { portableClone, serializeDomainRecord } from "../domain/contracts.mjs";
import { normalizeContentOpportunity } from "../domain/contentOpportunities.mjs";

function clone(value) {
  return portableClone(value);
}

function sortOpportunities(items) {
  return [...items].sort((left, right) => {
    const scoreOrder = Number(right.score || 0) - Number(left.score || 0);
    if (scoreOrder) return scoreOrder;
    const dateOrder = String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || ""));
    return dateOrder || String(left.opportunityId || "").localeCompare(String(right.opportunityId || ""));
  });
}

function assertSameOwner(existing, next) {
  if (existing && existing.workspaceId !== next.workspaceId) {
    throw new Error(`ContentOpportunity ${next.opportunityId} already belongs to another workspace.`);
  }
}

export function createMemoryContentOpportunityRepository(initial = []) {
  const records = new Map();
  for (const item of initial) {
    const opportunity = normalizeContentOpportunity(item);
    assertSameOwner(records.get(opportunity.opportunityId), opportunity);
    records.set(opportunity.opportunityId, opportunity);
  }
  return assertPort("contentOpportunityRepository", {
    async list() {
      return sortOpportunities(Array.from(records.values())).map(clone);
    },
    async get(opportunityId) {
      return records.has(opportunityId) ? clone(records.get(opportunityId)) : null;
    },
    async upsert(input) {
      const opportunity = normalizeContentOpportunity(input);
      assertSameOwner(records.get(opportunity.opportunityId), opportunity);
      records.set(opportunity.opportunityId, opportunity);
      return clone(opportunity);
    },
    async remove(opportunityId) {
      return records.delete(opportunityId);
    },
  });
}

export function createBrowserContentOpportunityRepository({
  getStorage,
  key = "signalflow_content_opportunities_v1",
  limit = 250,
} = {}) {
  if (typeof getStorage !== "function") throw new TypeError("Browser opportunity repository requires getStorage().");

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
    if (!Array.isArray(parsed)) throw new TypeError("Stored ContentOpportunity data must be an array.");
    return parsed;
  }

  function write(items) {
    const normalized = sortOpportunities(items.map(normalizeContentOpportunity)).slice(0, limit);
    storage().setItem(key, `[${normalized.map((item) => serializeDomainRecord(item)).join(",")}]`);
    return normalized;
  }

  async function list() {
    const raw = readRaw();
    const normalized = raw.map(normalizeContentOpportunity);
    const sorted = sortOpportunities(normalized).slice(0, limit);
    if (JSON.stringify(raw) !== JSON.stringify(sorted)) write(sorted);
    return sorted.map(clone);
  }

  async function get(opportunityId) {
    const items = await list();
    return items.find((item) => item.opportunityId === opportunityId) || null;
  }

  async function upsert(input) {
    const opportunity = normalizeContentOpportunity(input);
    const items = await list();
    assertSameOwner(items.find((item) => item.opportunityId === opportunity.opportunityId), opportunity);
    write([opportunity, ...items.filter((item) => item.opportunityId !== opportunity.opportunityId)]);
    return clone(opportunity);
  }

  async function remove(opportunityId) {
    const items = await list();
    const next = items.filter((item) => item.opportunityId !== opportunityId);
    write(next);
    return next.length !== items.length;
  }

  return assertPort("contentOpportunityRepository", { list, get, upsert, remove });
}

export function createStoreBackedContentOpportunityRepository({ store, prefix = "content-opportunity/" } = {}) {
  if (!store || ["list", "get", "set", "remove"].some((method) => typeof store[method] !== "function")) {
    throw new TypeError("Store-backed opportunity repository requires list/get/set/remove methods.");
  }
  const keyFor = (opportunityId) => `${prefix}${opportunityId}`;

  async function list() {
    const keys = await store.list(prefix);
    const items = [];
    for (const key of keys) {
      const value = await store.get(key);
      if (!value) continue;
      const normalized = normalizeContentOpportunity(value);
      items.push(normalized);
      if (JSON.stringify(value) !== JSON.stringify(normalized)) await store.set(key, normalized);
    }
    return sortOpportunities(items).map(clone);
  }

  async function get(opportunityId) {
    const value = await store.get(keyFor(opportunityId));
    if (!value) return null;
    const normalized = normalizeContentOpportunity(value);
    if (JSON.stringify(value) !== JSON.stringify(normalized)) await store.set(keyFor(opportunityId), normalized);
    return clone(normalized);
  }

  async function upsert(input) {
    const opportunity = normalizeContentOpportunity(input);
    assertSameOwner(await get(opportunity.opportunityId), opportunity);
    await store.set(keyFor(opportunity.opportunityId), opportunity);
    return clone(opportunity);
  }

  async function remove(opportunityId) {
    return Boolean(await store.remove(keyFor(opportunityId)));
  }

  return assertPort("contentOpportunityRepository", { list, get, upsert, remove });
}
