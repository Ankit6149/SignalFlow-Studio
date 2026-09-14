const OIDC_HEADER = "x-vercel-oidc-token";
const MAX_TOKEN_LENGTH = 20000;

function text(value) {
  return String(value || "").trim();
}

function safeToken(value) {
  const token = text(value);
  if (!token || token.length > MAX_TOKEN_LENGTH || /[\r\n]/.test(token)) return "";
  return token;
}

/**
 * Prefer Vercel's documented runtime OIDC environment credential. The header
 * fallback is retained only for compatibility with request-scoped runtimes
 * that surface the same credential there. Never prefer a caller-controlled
 * header over the platform-issued environment token when both exist.
 */
export function readVercelRuntimeOidcToken(request, env = process.env) {
  const fromEnvironment = safeToken(env?.VERCEL_OIDC_TOKEN);
  if (fromEnvironment) return fromEnvironment;
  return safeToken(request?.headers?.get?.(OIDC_HEADER));
}

export function vercelRuntimeOidcAvailable(request, env = process.env) {
  return Boolean(readVercelRuntimeOidcToken(request, env));
}
