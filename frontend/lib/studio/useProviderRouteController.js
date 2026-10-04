"use client";

import { useMemo, useState } from "react";
import { parseCapabilitySnapshot } from "../capabilities/capabilityContract.mjs";
import {
  evaluateProviderReadiness,
  getProviderCredentialPlacement,
  pickRecommendedProvider,
} from "./providerReadiness.mjs";
import {
  getCapabilities as getStudioCapabilities,
  testProviderRoute as testStudioProviderRoute,
} from "./studioApiClient.mjs";
import { PROVIDERS } from "./studioCatalog.mjs";

export function useProviderRouteController({ form, setForm }) {
  const [providerStatuses, setProviderStatuses] = useState({});
  const [capabilitySnapshot, setCapabilitySnapshot] = useState(null);
  const [providerStatusLoading, setProviderStatusLoading] = useState(true);
  const [providerTest, setProviderTest] = useState({ status: "idle", message: "" });

  const availableProviders = useMemo(
    () => PROVIDERS.filter(
      (item) => providerStatusLoading || providerStatuses[item.id]?.available !== false,
    ),
    [providerStatusLoading, providerStatuses],
  );

  const provider = useMemo(
    () => availableProviders.find((item) => item.id === form.provider) || availableProviders[0] || PROVIDERS[0],
    [availableProviders, form.provider],
  );

  const providerReadiness = evaluateProviderReadiness({
    provider: form.provider,
    apiKey: form.apiKey,
    baseUrl: form.baseUrl,
    status: providerStatusLoading
      ? { available: false, reason: "Checking deployment capabilities…" }
      : providerStatuses[form.provider],
  });

  const providerCredentialPlacement = getProviderCredentialPlacement({
    provider: form.provider,
    status: providerStatusLoading
      ? { available: false, reason: "Checking deployment capabilities…" }
      : providerStatuses[form.provider],
  });

  async function refreshProviderStatus() {
    setProviderStatusLoading(true);
    try {
      const { response, data: raw } = await getStudioCapabilities();
      if (!response.ok) throw new Error(raw.error || "SignalFlow could not read deployment capabilities.");
      const data = parseCapabilitySnapshot(raw);
      const statuses = data.capabilities.models.providers;
      setCapabilitySnapshot(data);
      setProviderStatuses(statuses);
      const recommended = pickRecommendedProvider({
        statuses,
        fallback: form.provider,
      });
      setForm((previous) => {
        const current = statuses[previous.provider];
        if (
          current?.available !== false &&
          (previous.apiKey.trim() || previous.baseUrl.trim() || current?.configured)
        ) {
          return previous;
        }
        return previous.provider === recommended ? previous : { ...previous, provider: recommended };
      });
    } catch (error) {
      setCapabilitySnapshot(null);
      setProviderStatuses(
        Object.fromEntries(PROVIDERS.map((item) => [item.id, {
          id: item.id,
          label: item.label,
          available: false,
          configured: false,
          reason: error.message || "SignalFlow could not verify this model route.",
        }])),
      );
    } finally {
      setProviderStatusLoading(false);
    }
  }

  async function testProviderConnection() {
    if (!providerReadiness.ready) {
      setProviderTest({ status: "error", message: providerReadiness.reason });
      return;
    }
    setProviderTest({ status: "testing", message: "Testing model route…" });
    try {
      const { response, data } = await testStudioProviderRoute({
        provider: form.provider,
        modelName: form.model.trim(),
        baseUrl: form.baseUrl.trim(),
        temporaryApiKey: form.apiKey.trim(),
      });
      if (!response.ok || !data.ok) throw new Error(data.error || "Model route test failed.");
      setProviderTest({ status: "success", message: data.message || "Model route connected successfully." });
      void refreshProviderStatus();
    } catch (error) {
      setProviderTest({ status: "error", message: error.message });
    }
  }

  return {
    availableProviders,
    provider,
    providerStatuses,
    capabilitySnapshot,
    providerStatusLoading,
    providerTest,
    providerReadiness,
    providerCredentialPlacement,
    refreshProviderStatus,
    testProviderConnection,
  };
}
