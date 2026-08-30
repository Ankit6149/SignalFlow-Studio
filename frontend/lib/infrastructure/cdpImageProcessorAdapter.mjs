import { assertPort } from "../domain/ports.mjs";
import { createCdpWebSocketClient } from "./cdpCaptureWorkerAdapter.mjs";

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const DEFAULT_COMMAND_TIMEOUT_MS = 20000;

export class CdpImageProcessorError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "CdpImageProcessorError";
    this.code = code;
    this.details = { ...details };
  }
}

function requiredText(value, field, maxLength = 12000) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new CdpImageProcessorError("image_processor_configuration_missing", `${field} is required.`, { field });
  if (normalized.length > maxLength) throw new CdpImageProcessorError("image_processor_configuration_invalid", `${field} is too long.`, { field });
  return normalized;
}

function normalizeEndpoint(value, allowInsecureLocalhost = false) {
  let url;
  try {
    url = new URL(requiredText(value, "browserWSEndpoint"));
  } catch {
    throw new CdpImageProcessorError("image_processor_endpoint_invalid", "Image processor browser endpoint must be a WebSocket URL.");
  }
  if (url.username || url.password) throw new CdpImageProcessorError("image_processor_endpoint_invalid", "Image processor endpoint cannot contain URL userinfo credentials.");
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "wss:" && !(allowInsecureLocalhost === true && local && url.protocol === "ws:")) {
    throw new CdpImageProcessorError("image_processor_endpoint_insecure", "Remote image processing requires WSS.");
  }
  return url.toString();
}

async function toBytes(value) {
  let bytes;
  if (value instanceof Uint8Array) bytes = new Uint8Array(value);
  else if (value instanceof ArrayBuffer) bytes = new Uint8Array(value.slice(0));
  else if (typeof Blob !== "undefined" && value instanceof Blob) bytes = new Uint8Array(await value.arrayBuffer());
  else throw new CdpImageProcessorError("unsupported_image_bytes", "Image processor accepts Uint8Array, ArrayBuffer, or Blob input.");
  if (!bytes.byteLength) throw new CdpImageProcessorError("empty_image", "Image processor cannot process zero-byte input.");
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new CdpImageProcessorError("image_too_large", "Image exceeds the bounded processor input size.");
  return bytes;
}

function encodeBase64(bytes) {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return btoa(binary);
}

function decodeBase64(value) {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(String(value), "base64"));
  const binary = atob(String(value));
  const output = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) output[index] = binary.charCodeAt(index);
  return output;
}

function normalizeMimeType(value) {
  const normalized = String(value || "image/png").trim().toLowerCase().split(";", 1)[0];
  if (!["image/png", "image/jpeg", "image/webp"].includes(normalized)) {
    throw new CdpImageProcessorError("unsupported_image_format", "Screenshot processor supports PNG, JPEG, and WebP inputs.");
  }
  return normalized;
}

function positiveInteger(value, field, maximum = 10000) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > maximum) throw new CdpImageProcessorError("invalid_image_geometry", `${field} is invalid.`, { field });
  return Math.round(parsed);
}

function normalizeCrop(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CdpImageProcessorError("invalid_image_crop", "Derivative render requires an explicit crop rectangle.");
  return {
    x: Math.max(0, Math.round(Number(value.x || 0))),
    y: Math.max(0, Math.round(Number(value.y || 0))),
    width: positiveInteger(value.width, "crop.width"),
    height: positiveInteger(value.height, "crop.height"),
  };
}

function normalizeTarget(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CdpImageProcessorError("invalid_image_target", "Derivative render requires target dimensions.");
  return {
    width: positiveInteger(value.width, "targetDimensions.width", 4096),
    height: positiveInteger(value.height, "targetDimensions.height", 4096),
  };
}

async function runControlledPage(client, task) {
  let targetId = null;
  try {
    const created = await client.send("Target.createTarget", { url: "about:blank" });
    targetId = requiredText(created.targetId, "targetId", 500);
    const attached = await client.send("Target.attachToTarget", { targetId, flatten: true });
    const sessionId = requiredText(attached.sessionId, "sessionId", 500);
    await client.send("Runtime.enable", {}, sessionId);
    return await task({ client, sessionId });
  } finally {
    if (targetId) await client.send("Target.closeTarget", { targetId }).catch(() => {});
    await client.close().catch(() => {});
  }
}

async function evaluate(client, sessionId, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: false,
  }, sessionId);
  if (result.exceptionDetails) throw new CdpImageProcessorError("image_processing_failed", "Controlled browser image processing failed.");
  return result.result?.value;
}

export function createCdpImageProcessorAdapter({
  browserWSEndpoint,
  commandTimeoutMs = DEFAULT_COMMAND_TIMEOUT_MS,
  allowInsecureLocalhost = false,
  clientFactory = null,
  webSocketFactory = null,
} = {}) {
  const endpoint = normalizeEndpoint(browserWSEndpoint, allowInsecureLocalhost);
  const createClient = clientFactory || (() => createCdpWebSocketClient({
    endpoint,
    ...(webSocketFactory ? { webSocketFactory } : {}),
    commandTimeoutMs,
  }));

  const adapter = {
    async describe() {
      return {
        available: true,
        adapterKind: "cdp_image_processor",
        adapterVersion: 1,
        capabilities: ["decode", "blank_detection", "crop_resize", "png_output"],
        maxInputBytes: MAX_IMAGE_BYTES,
      };
    },

    async analyze({ bytes: inputBytes, mimeType = "image/png" } = {}) {
      const bytes = await toBytes(inputBytes);
      const mime = normalizeMimeType(mimeType);
      const base64 = encodeBase64(bytes);
      const client = await createClient();
      return runControlledPage(client, async ({ client: pageClient, sessionId }) => {
        const value = await evaluate(pageClient, sessionId, `(async () => {
          const image = new Image();
          image.src = ${JSON.stringify(`data:${mime};base64,${base64}`)};
          try { await image.decode(); } catch { return { decodeOk: false }; }
          const sampleSize = 32;
          const canvas = document.createElement("canvas");
          canvas.width = sampleSize;
          canvas.height = sampleSize;
          const context = canvas.getContext("2d", { willReadFrequently: true });
          context.drawImage(image, 0, 0, sampleSize, sampleSize);
          const pixels = context.getImageData(0, 0, sampleSize, sampleSize).data;
          let total = 0;
          let totalSquared = 0;
          let opaque = 0;
          const count = sampleSize * sampleSize;
          for (let index = 0; index < pixels.length; index += 4) {
            const luminance = pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722;
            total += luminance;
            totalSquared += luminance * luminance;
            if (pixels[index + 3] > 8) opaque += 1;
          }
          const mean = total / count;
          const variance = Math.max(0, totalSquared / count - mean * mean);
          const blankLike = opaque / count < 0.02 || variance < 2.25;
          return {
            decodeOk: true,
            width: image.naturalWidth,
            height: image.naturalHeight,
            blankLike,
            blankConfidence: blankLike ? 0.92 : 0.88,
            opaqueRatio: opaque / count,
            luminanceVariance: variance
          };
        })()`);
        if (!value || value.decodeOk === false) return { decodeOk: false, blankLike: null, blankConfidence: null, legible: false, legibilityConfidence: 1 };
        const width = positiveInteger(value.width, "decoded.width");
        const height = positiveInteger(value.height, "decoded.height");
        const minDimension = Math.min(width, height);
        return {
          decodeOk: true,
          dimensions: { width, height },
          blankLike: value.blankLike === true,
          blankConfidence: Number(value.blankConfidence || 0.8),
          legible: minDimension >= 720,
          legibilityConfidence: minDimension >= 720 ? 0.85 : 0.9,
          analysis: {
            opaqueRatio: Number(value.opaqueRatio || 0),
            luminanceVariance: Number(value.luminanceVariance || 0),
          },
        };
      });
    },

    async render({ bytes: inputBytes, mimeType = "image/png", crop: cropInput, targetDimensions: targetInput, aspectRatio = null } = {}) {
      const bytes = await toBytes(inputBytes);
      const mime = normalizeMimeType(mimeType);
      const crop = normalizeCrop(cropInput);
      const target = normalizeTarget(targetInput);
      const base64 = encodeBase64(bytes);
      const client = await createClient();
      return runControlledPage(client, async ({ client: pageClient, sessionId }) => {
        const value = await evaluate(pageClient, sessionId, `(async () => {
          const image = new Image();
          image.src = ${JSON.stringify(`data:${mime};base64,${base64}`)};
          try { await image.decode(); } catch { return { ok: false, code: "decode_failed" }; }
          const crop = ${JSON.stringify(crop)};
          const target = ${JSON.stringify(target)};
          if (crop.x + crop.width > image.naturalWidth || crop.y + crop.height > image.naturalHeight) {
            return { ok: false, code: "crop_out_of_bounds" };
          }
          const canvas = document.createElement("canvas");
          canvas.width = target.width;
          canvas.height = target.height;
          const context = canvas.getContext("2d", { alpha: false });
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = "high";
          context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, target.width, target.height);
          return { ok: true, data: canvas.toDataURL("image/png", 1).split(",")[1] };
        })()`);
        if (!value?.ok) throw new CdpImageProcessorError(value?.code === "crop_out_of_bounds" ? "image_crop_out_of_bounds" : "image_decode_failed", "Screenshot derivative could not be rendered.");
        const output = decodeBase64(requiredText(value.data, "renderedImage", 100_000_000));
        return {
          bytes: output,
          mimeType: "image/png",
          dimensions: target,
          originalName: `screenshot-${String(aspectRatio || `${target.width}x${target.height}`).replace(":", "x")}.png`,
        };
      });
    },
  };

  return assertPort("imageProcessorAdapter", adapter);
}
