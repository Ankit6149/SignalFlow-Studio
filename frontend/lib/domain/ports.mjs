export const PORT_CONTRACTS = Object.freeze({
  campaignRepository: ["list", "get", "upsert", "remove"],
  assetRepository: ["list", "get", "upsert", "remove"],
  blobStorage: ["put", "get", "remove"],
  jobQueue: ["enqueue", "get", "cancel"],
  providerAdapter: ["test", "generate"],
  connectorAdapter: ["status", "publish"],
  notificationAdapter: ["send"],
  clock: ["now"],
  idService: ["create"],
});

export function assertPort(name, adapter) {
  const methods = PORT_CONTRACTS[name];
  if (!methods) throw new TypeError(`Unknown application port: ${name}.`);
  if (!adapter || typeof adapter !== "object") {
    throw new TypeError(`${name} adapter is required.`);
  }
  for (const method of methods) {
    if (typeof adapter[method] !== "function") {
      throw new TypeError(`${name}.${method} must be a function.`);
    }
  }
  return adapter;
}

export function createSystemClock() {
  return {
    now() {
      return new Date().toISOString();
    },
  };
}

export function createDeterministicIdService(prefix = "sf") {
  let sequence = 0;
  return {
    create(kind = "record") {
      sequence += 1;
      return `${prefix}-${String(kind).toLowerCase()}-${sequence}`;
    },
  };
}
