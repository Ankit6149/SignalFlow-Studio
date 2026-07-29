import fs from "node:fs";

const path = "frontend/lib/capabilities/capabilityContract.mjs";
let source = fs.readFileSync(path, "utf8");

const from = `function normalizeProviderMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).map(([id, provider]) => {
      const normalized = normalizeCapability(
        provider,
        \`${"${id}"} is unavailable in this SignalFlow session.\`,
      );
      return [id, {
        ...normalized,
        id,
        label: text(provider?.label, id),
        configured: boolean(provider?.configured),
        supportsTemporaryKey: boolean(provider?.supportsTemporaryKey),
        requiresBaseUrl: boolean(provider?.requiresBaseUrl),
        isLocal: boolean(provider?.isLocal),
        defaultModel: text(provider?.defaultModel),
      }];
    }),
  );
}`;

const to = `function normalizeProviderMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).map(([id, provider]) => [id, {
      id,
      label: text(provider?.label, id),
      available: boolean(provider?.available),
      reason: text(
        provider?.reason,
        \`${"${id}"} is unavailable in this SignalFlow session.\`,
      ),
      configured: boolean(provider?.configured),
      supportsTemporaryKey: boolean(provider?.supportsTemporaryKey),
      requiresBaseUrl: boolean(provider?.requiresBaseUrl),
      isLocal: boolean(provider?.isLocal),
      defaultModel: text(provider?.defaultModel),
    }]),
  );
}`;

const count = source.split(from).length - 1;
if (count !== 1) throw new Error(`Expected one provider parser block, found ${count}.`);
source = source.replace(from, to);
fs.writeFileSync(path, source);
