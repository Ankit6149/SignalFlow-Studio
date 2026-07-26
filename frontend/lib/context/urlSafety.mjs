import dns from "node:dns/promises";
import net from "node:net";

function privateFetchesAllowed() {
  return process.env.SIGNALFLOW_ALLOW_PRIVATE_FETCHES === "true";
}

function hostedSafetyRequired() {
  return !privateFetchesAllowed() && (
    process.env.SIGNALFLOW_PUBLIC_HOSTED === "true" ||
    Boolean(process.env.VERCEL) ||
    process.env.NODE_ENV === "production"
  );
}

export function normalizeHttpUrl(input) {
  let normalized = String(input || "").trim();
  if (!normalized) {
    throw new Error("URL is empty.");
  }
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }
  const url = new URL(normalized);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only http and https URLs are supported.");
  }
  if (url.username || url.password) {
    throw new Error("URLs with embedded credentials are not allowed.");
  }
  return url;
}

export function isBlockedHostname(hostname) {
  const host = String(hostname || "").toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  return (
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata" ||
    host.includes("metadata.google.internal")
  );
}

export function isPrivateAddress(address) {
  const value = String(address || "").toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  const version = net.isIP(value);
  if (version === 4) {
    const parts = value.split(".").map(Number);
    const [a, b, c] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 192 && b === 88 && c === 99) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224
    );
  }
  if (version === 6) {
    if (value === "::" || value === "::1") return true;
    if (value.startsWith("fc") || value.startsWith("fd")) return true;
    if (/^fe[89ab]/.test(value)) return true;
    if (value.startsWith("ff")) return true;
    if (value.startsWith("100:")) return true;
    if (/^2001:0?db8:/i.test(value)) return true;
    const mapped = value.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateAddress(mapped[1]) : false;
  }
  return false;
}

export async function assertSafeRemoteUrl(input, { resolveDns = true, forceHostedSafety } = {}) {
  const url = input instanceof URL ? new URL(input.toString()) : normalizeHttpUrl(input);
  const enforce = typeof forceHostedSafety === "boolean" ? forceHostedSafety : hostedSafetyRequired();
  if (!enforce) return url;

  if (url.port && !["80", "443"].includes(url.port)) {
    throw new Error("Non-standard network ports are blocked in hosted mode.");
  }
  if (isBlockedHostname(url.hostname)) {
    throw new Error("Local or internal hostnames are blocked in hosted mode.");
  }
  if (net.isIP(url.hostname.replace(/^\[|\]$/g, ""))) {
    if (isPrivateAddress(url.hostname)) {
      throw new Error("Private or reserved IP addresses are blocked in hosted mode.");
    }
    return url;
  }
  if (resolveDns) {
    const answers = await dns.lookup(url.hostname, { all: true, verbatim: true });
    if (!answers.length) {
      throw new Error("The hostname did not resolve to a public address.");
    }
    if (answers.some(({ address }) => isPrivateAddress(address))) {
      throw new Error("The hostname resolves to a private or reserved address.");
    }
  }
  return url;
}
