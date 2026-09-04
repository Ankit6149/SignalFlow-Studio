import { resolveGithubInstallStateSecret } from "./runtimeSigningSecrets.mjs";

function text(value) {
  return String(value || "").trim();
}

function productionOrigin(env) {
  const explicit = text(env?.NEXTAUTH_URL);
  if (explicit) return explicit;
  const vercelProductionUrl = text(env?.VERCEL_PROJECT_PRODUCTION_URL);
  if (!vercelProductionUrl) return "";
  return /^https?:\/\//i.test(vercelProductionUrl)
    ? vercelProductionUrl
    : `https://${vercelProductionUrl}`;
}

export function resolveGithubRuntimeEnv(env = process.env) {
  return {
    ...env,
    NEXTAUTH_URL: productionOrigin(env),
    GITHUB_INSTALL_STATE_SECRET: resolveGithubInstallStateSecret(env),
  };
}
