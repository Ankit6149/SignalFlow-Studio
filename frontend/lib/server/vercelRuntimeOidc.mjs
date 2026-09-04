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

export function readVercelRuntimeOidcToken(request, env = process.env) {
  const fromHeader = safeToken(request?.headers?.get?.(OIDC_HEADER));
  if (fromHeader) return fromHeader;
  return safeToken(env?.VERCEL_OIDC_TOKEN);
}

export function vercelRuntimeOidcAvailable(request, env = process.env) {
  return Boolean(readVercelRuntimeOidcToken(request, env));
}
