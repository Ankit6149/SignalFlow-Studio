import { createHmac } from "node:crypto";

const MIN_DERIVATION_ROOT_LENGTH = 32;

function text(value) {
  return String(value || "").trim();
}

function derive(root, purpose) {
  return createHmac("sha256", root)
    .update(`signalflow:${purpose}:v1`, "utf8")
    .digest("base64url");
}

function derivationRoot(env) {
  const ownerSecret = text(env?.SIGNALFLOW_ACCESS_KEY);
  return ownerSecret.length >= MIN_DERIVATION_ROOT_LENGTH ? ownerSecret : "";
}

export function resolveGithubInstallStateSecret(env = process.env) {
  const explicit = text(env?.GITHUB_INSTALL_STATE_SECRET);
  if (explicit) return explicit;
  const ownerSecret = derivationRoot(env);
  return ownerSecret ? derive(ownerSecret, "github-install-state") : "";
}

export function resolveMediaPreviewReceiptSecret(env = process.env) {
  const explicit = text(env?.SIGNALFLOW_MEDIA_PREVIEW_RECEIPT_SECRET);
  if (explicit) return explicit;
  const ownerSecret = derivationRoot(env);
  return ownerSecret ? derive(ownerSecret, "media-preview-receipt") : "";
}

export function resolveCredentialVaultSecret(env = process.env) {
  const explicit = text(env?.SIGNALFLOW_CREDENTIAL_VAULT_SECRET);
  if (explicit) return explicit;
  const ownerSecret = derivationRoot(env);
  return ownerSecret ? derive(ownerSecret, "credential-vault") : "";
}
