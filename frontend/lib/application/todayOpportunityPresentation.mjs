const ACTIONABLE_STATUSES = new Set(["proposed", "shortlisted"]);

export function isTodayActionableOpportunity(entry) {
  const opportunity = entry?.opportunity;
  return Boolean(
    opportunity
      && opportunity.recommendation === "post"
      && ACTIONABLE_STATUSES.has(opportunity.status)
      && !opportunity.selectedAngleId,
  );
}

export function filterTodayActionableOpportunities(entries) {
  return (Array.isArray(entries) ? entries : []).filter(isTodayActionableOpportunity);
}
