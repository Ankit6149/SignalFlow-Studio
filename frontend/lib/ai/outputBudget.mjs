function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Reserve enough output space for each specialised destination stage. The
 * caller can still override this through config.maxTokens.
 */
export function resolveOutputTokenBudget(prompt, configuredValue) {
  const explicit = Number(configuredValue);
  if (Number.isFinite(explicit) && explicit > 0) return clamp(Math.round(explicit), 512, 8000);

  const text = String(prompt || "").toLowerCase();
  if (text.includes("1200-2500 word") || text.includes("1200-2500 words")) return 6500;
  if (text.includes("500-1000 word") || text.includes("500-1000 words")) return 3600;
  if (text.includes("450-900 word") || text.includes("450-900 words")) return 3200;
  if (text.includes("450-900 word description")) return 3200;
  if (text.includes("300-650 word") || text.includes("300-650 words")) return 2600;
  if (text.includes("campaign truth brief") || text.includes("campaign strategist and product analyst")) return 4200;
  if (text.includes("4-8 complete posts")) return 1800;
  if (text.includes("180-350 word") || text.includes("180-350 words")) return 1800;
  return 3000;
}
