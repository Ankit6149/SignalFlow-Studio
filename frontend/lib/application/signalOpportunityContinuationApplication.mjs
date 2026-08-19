import { assertPort } from "../domain/ports.mjs";
import { normalizeContentSignal } from "../domain/contentSignals.mjs";

function requiredWorkspaceId(value) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new TypeError("Signal opportunity continuation requires a workspaceId.");
  return normalized;
}

function requireApplicationMethod(application, method, label) {
  if (!application || typeof application[method] !== "function") {
    throw new TypeError(`${label} requires ${method}().`);
  }
  return application;
}

export function createSignalOpportunityContinuationApplication({
  workspaceId,
  contentSignalRepository,
  projectContextApplication,
  contentOpportunityApplication,
} = {}) {
  const ownerWorkspaceId = requiredWorkspaceId(workspaceId);
  const signals = assertPort("contentSignalRepository", contentSignalRepository);
  const projectContexts = requireApplicationMethod(projectContextApplication, "resolveLatestForSignal", "ProjectContext application");
  const opportunities = requireApplicationMethod(contentOpportunityApplication, "evaluateSignal", "ContentOpportunity application");

  async function requireSignal(signalId) {
    const normalizedId = String(signalId || "").trim();
    if (!normalizedId) throw new TypeError("Signal opportunity continuation requires a signalId.");
    const stored = await signals.get(normalizedId);
    if (!stored) throw new Error(`ContentSignal ${normalizedId} does not exist.`);
    const signal = normalizeContentSignal(stored);
    if (signal.workspaceId !== ownerWorkspaceId) {
      throw new Error(`ContentSignal ${signal.signalId} does not belong to workspace ${ownerWorkspaceId}.`);
    }
    return signal;
  }

  async function continueToOpportunity(signalId, { refresh = false } = {}) {
    const signal = await requireSignal(signalId);
    const projectContext = signal.projectId
      ? await projectContexts.resolveLatestForSignal(signal)
      : null;
    const opportunity = await opportunities.evaluateSignal(signal.signalId, {
      refresh,
      projectContext,
    });
    return Object.freeze({ signal, projectContext, opportunity });
  }

  return { continueToOpportunity };
}
