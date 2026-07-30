import { assertPort } from "../domain/ports.mjs";
import { createDomainRecord, parseDomainRecord, portableClone, stableStringify } from "../domain/contracts.mjs";

const RECORD_SPECS = Object.freeze({
  asset: { portName: "assetRepository", kind: "Asset", idField: "assetId" },
  sourceArtifact: { portName: "sourceArtifactRepository", kind: "SourceArtifact", idField: "sourceArtifactId" },
  approval: { portName: "approvalRepository", kind: "Approval", idField: "approvalId" },
  export: { portName: "exportRepository", kind: "Export", idField: "exportId" },
  transferReport: { portName: "transferReportRepository", kind: "TransferReport", idField: "transferReportId" },
});

function clone(value) {
  return portableClone(value);
}

function sortByUpdated(items) {
  return [...items].sort((left, right) => String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || "")));
}

function spec(name) {
  const value = RECORD_SPECS[name];
  if (!value) throw new TypeError(`Unknown transfer record repository: ${name}.`);
  return value;
}

function normalizeRecord(kind, idField, value) {
  if (value?.kind === kind) return parseDomainRecord(value, kind);
  return createDomainRecord(kind, { ...value, [idField]: value?.[idField] });
}

function createMemoryRecordRepository({ portName, kind, idField, initial = [] }) {
  const records = new Map();
  for (const item of initial) {
    const normalized = normalizeRecord(kind, idField, item);
    records.set(normalized[idField], normalized);
  }
  return assertPort(portName, {
    async list() {
      return sortByUpdated(Array.from(records.values())).map(clone);
    },
    async get(id) {
      return records.has(id) ? clone(records.get(id)) : null;
    },
    async upsert(value) {
      const normalized = normalizeRecord(kind, idField, value);
      records.set(normalized[idField], normalized);
      return clone(normalized);
    },
    async remove(id) {
      return records.delete(id);
    },
  });
}

function createStoreBackedRecordRepository({ store, portName, kind, idField, prefix }) {
  if (!store || ["list", "get", "set", "remove"].some((method) => typeof store[method] !== "function")) {
    throw new TypeError(`${kind} store requires list/get/set/remove methods.`);
  }
  const keyFor = (id) => `${prefix}${id}`;
  return assertPort(portName, {
    async list() {
      const keys = await store.list(prefix);
      const values = await Promise.all(keys.map((key) => store.get(key)));
      return sortByUpdated(values.filter(Boolean).map((value) => normalizeRecord(kind, idField, value))).map(clone);
    },
    async get(id) {
      const value = await store.get(keyFor(id));
      return value ? clone(normalizeRecord(kind, idField, value)) : null;
    },
    async upsert(value) {
      const normalized = normalizeRecord(kind, idField, value);
      await store.set(keyFor(normalized[idField]), normalized);
      return clone(normalized);
    },
    async remove(id) {
      return Boolean(await store.remove(keyFor(id)));
    },
  });
}

function createBrowserRecordRepository({ getStorage, key, limit, portName, kind, idField }) {
  if (typeof getStorage !== "function") throw new TypeError(`${kind} browser repository requires getStorage().`);
  const storage = () => {
    const target = getStorage();
    if (!target || typeof target.getItem !== "function" || typeof target.setItem !== "function") {
      throw new TypeError("Browser storage is unavailable.");
    }
    return target;
  };
  function read() {
    const raw = storage().getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  }
  function write(items) {
    const normalized = sortByUpdated(items).slice(0, limit);
    storage().setItem(key, stableStringify(normalized));
    return normalized;
  }
  async function list() {
    return sortByUpdated(read().map((value) => normalizeRecord(kind, idField, value))).map(clone);
  }
  async function get(id) {
    const items = await list();
    return items.find((item) => item[idField] === id) || null;
  }
  async function upsert(value) {
    const normalized = normalizeRecord(kind, idField, value);
    const items = await list();
    write([normalized, ...items.filter((item) => item[idField] !== normalized[idField])]);
    return clone(normalized);
  }
  async function remove(id) {
    const items = await list();
    const next = items.filter((item) => item[idField] !== id);
    write(next);
    return next.length !== items.length;
  }
  return assertPort(portName, { list, get, upsert, remove });
}

function memoryRepository(name, initial = []) {
  return createMemoryRecordRepository({ ...spec(name), initial });
}

function storeRepository(name, { store, prefix }) {
  return createStoreBackedRecordRepository({ ...spec(name), store, prefix });
}

function browserRepository(name, { getStorage, key, limit }) {
  return createBrowserRecordRepository({ ...spec(name), getStorage, key, limit });
}

export function createMemoryAssetRepository(initial = []) {
  return memoryRepository("asset", initial);
}

export function createStoreBackedAssetRepository({ store, prefix = "asset/" } = {}) {
  return storeRepository("asset", { store, prefix });
}

export function createBrowserAssetRepository({ getStorage, key = "signalflow_assets_v1", limit = 250 } = {}) {
  return browserRepository("asset", { getStorage, key, limit });
}

export function createMemorySourceArtifactRepository(initial = []) {
  return memoryRepository("sourceArtifact", initial);
}

export function createStoreBackedSourceArtifactRepository({ store, prefix = "source-artifact/" } = {}) {
  return storeRepository("sourceArtifact", { store, prefix });
}

export function createBrowserSourceArtifactRepository({ getStorage, key = "signalflow_source_artifacts_v1", limit = 500 } = {}) {
  return browserRepository("sourceArtifact", { getStorage, key, limit });
}

export function createMemoryApprovalRepository(initial = []) {
  return memoryRepository("approval", initial);
}

export function createStoreBackedApprovalRepository({ store, prefix = "approval/" } = {}) {
  return storeRepository("approval", { store, prefix });
}

export function createBrowserApprovalRepository({ getStorage, key = "signalflow_approvals_v1", limit = 500 } = {}) {
  return browserRepository("approval", { getStorage, key, limit });
}

export function createMemoryExportRepository(initial = []) {
  return memoryRepository("export", initial);
}

export function createStoreBackedExportRepository({ store, prefix = "export/" } = {}) {
  return storeRepository("export", { store, prefix });
}

export function createBrowserExportRepository({ getStorage, key = "signalflow_exports_v1", limit = 500 } = {}) {
  return browserRepository("export", { getStorage, key, limit });
}

export function createMemoryTransferReportRepository(initial = []) {
  return memoryRepository("transferReport", initial);
}

export function createStoreBackedTransferReportRepository({ store, prefix = "transfer-report/" } = {}) {
  return storeRepository("transferReport", { store, prefix });
}

export function createBrowserTransferReportRepository({ getStorage, key = "signalflow_transfer_reports_v1", limit = 50 } = {}) {
  return browserRepository("transferReport", { getStorage, key, limit });
}

function bytesToBase64(bytes) {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(String(value), "base64"));
  const binary = atob(String(value));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function encodeBrowserBlob(value) {
  if (value instanceof Uint8Array) return { type: "bytes", value: bytesToBase64(value) };
  if (value instanceof ArrayBuffer) return { type: "bytes", value: bytesToBase64(new Uint8Array(value)) };
  if (typeof value === "string") return { type: "text", value };
  return { type: "json", value: portableClone(value) };
}

function decodeBrowserBlob(value) {
  if (!value) return null;
  if (value.type === "bytes") return base64ToBytes(value.value);
  if (value.type === "text") return String(value.value || "");
  if (value.type === "json") return portableClone(value.value);
  throw new TypeError(`Unsupported browser blob type: ${value.type || "missing"}.`);
}

export function createBrowserBlobStorage({ getStorage, key = "signalflow_blobs_v1" } = {}) {
  if (typeof getStorage !== "function") throw new TypeError("Browser blob storage requires getStorage().");
  const storage = () => {
    const target = getStorage();
    if (!target || typeof target.getItem !== "function" || typeof target.setItem !== "function") {
      throw new TypeError("Browser storage is unavailable.");
    }
    return target;
  };
  function read() {
    const raw = storage().getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  }
  function write(value) {
    storage().setItem(key, JSON.stringify(value));
  }
  return assertPort("blobStorage", {
    async put(blobId, value) {
      const records = read();
      records[blobId] = encodeBrowserBlob(value);
      write(records);
      return { blobId };
    },
    async get(blobId) {
      return decodeBrowserBlob(read()[blobId]);
    },
    async remove(blobId) {
      const records = read();
      const existed = Object.prototype.hasOwnProperty.call(records, blobId);
      delete records[blobId];
      write(records);
      return existed;
    },
  });
}
