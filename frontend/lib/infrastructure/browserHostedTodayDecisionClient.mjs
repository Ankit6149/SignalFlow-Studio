function requireFetch(fetchImpl) {
  if (typeof fetchImpl !== "function") throw new TypeError("Hosted Today decisions require fetch().");
  return fetchImpl;
}

function required(value, field, maxLength = 400) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length > maxLength) {
    const error = new Error(`Hosted Today decision contract is missing ${field}.`);
    error.code = "hosted_today_contract_invalid";
    throw error;
  }
  return normalized;
}

function normalizeDecision(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    const error = new Error("Hosted Today returned an invalid decision record.");
    error.code = "hosted_today_contract_invalid";
    throw error;
  }
  const destination = required(input.destination, "destination", 40).toLowerCase();
  if (!["linkedin", "x"].includes(destination)) {
    const error = new Error("Hosted Today returned an unsupported destination.");
    error.code = "hosted_today_contract_invalid";
    throw error;
  }
  if (!Number.isInteger(input.revisionNumber) || input.revisionNumber < 1) {
    const error = new Error("Hosted Today returned an invalid revision number.");
    error.code = "hosted_today_contract_invalid";
    throw error;
  }
  return Object.freeze({
    ...input,
    decisionId: required(input.decisionId, "decisionId"),
    platformVariantId: required(input.platformVariantId, "platformVariantId"),
    platformVariantRevisionId: required(input.platformVariantRevisionId, "platformVariantRevisionId"),
    platformVariantReviewId: required(input.platformVariantReviewId, "platformVariantReviewId"),
    destination,
    revisionNumber: input.revisionNumber,
    mediaBindings: Array.isArray(input.mediaBindings) ? input.mediaBindings.map((item) => Object.freeze({ ...item })) : [],
    findings: Array.isArray(input.findings) ? input.findings.map((item) => Object.freeze({ ...item })) : [],
    origin: "hosted",
  });
}

function normalizeWorkItem(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    const error = new Error("Hosted Today returned an invalid work-state record.");
    error.code = "hosted_today_contract_invalid";
    throw error;
  }
  const priority = required(input.priority, "workState.priority", 40).toLowerCase();
  if (!["attention", "progress"].includes(priority)) {
    const error = new Error("Hosted Today returned an unsupported work-state priority.");
    error.code = "hosted_today_contract_invalid";
    throw error;
  }
  const destination = required(input.destination, "workState.destination", 40).toLowerCase();
  if (!["linkedin", "x"].includes(destination)) {
    const error = new Error("Hosted Today returned an unsupported work-state destination.");
    error.code = "hosted_today_contract_invalid";
    throw error;
  }
  return Object.freeze({
    ...input,
    workId: required(input.workId, "workState.workId"),
    platformVariantId: required(input.platformVariantId, "workState.platformVariantId"),
    opportunityId: required(input.opportunityId, "workState.opportunityId"),
    stage: required(input.stage, "workState.stage", 80),
    label: required(input.label, "workState.label", 160),
    explanation: required(input.explanation, "workState.explanation", 1200),
    destination,
    priority,
    origin: "hosted",
  });
}


function normalizeComingUpItem(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    const error = new Error("Hosted Today returned an invalid coming-up record.");
    error.code = "hosted_today_contract_invalid";
    throw error;
  }
  const schedulingState = required(input.schedulingState, "comingUp.schedulingState", 80).toLowerCase();
  if (schedulingState !== "not_scheduled") {
    const error = new Error("Hosted Today returned an unsupported coming-up scheduling state.");
    error.code = "hosted_today_contract_invalid";
    throw error;
  }
  const destinations = Array.isArray(input.destinations) ? input.destinations.map((item) => {
    const destination = required(item?.destination, "comingUp.destination", 40).toLowerCase();
    if (!["linkedin", "x"].includes(destination)) {
      const error = new Error("Hosted Today returned an unsupported coming-up destination.");
      error.code = "hosted_today_contract_invalid";
      throw error;
    }
    return Object.freeze({
      destination,
      platformVariantId: required(item.platformVariantId, "comingUp.platformVariantId"),
      platformVariantRevisionId: required(item.platformVariantRevisionId, "comingUp.platformVariantRevisionId"),
      status: "approved",
    });
  }) : [];
  if (!destinations.length) {
    const error = new Error("Hosted Today coming-up records require at least one approved destination.");
    error.code = "hosted_today_contract_invalid";
    throw error;
  }
  return Object.freeze({
    ...input,
    comingUpId: required(input.comingUpId, "comingUpId"),
    contentPieceId: required(input.contentPieceId, "comingUp.contentPieceId"),
    narrativeStrategyId: required(input.narrativeStrategyId, "comingUp.narrativeStrategyId"),
    opportunityId: required(input.opportunityId, "comingUp.opportunityId"),
    schedulingState,
    destinations: Object.freeze(destinations),
    origin: "hosted",
  });
}

async function parseResponse(response) {
  const raw = await response.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    const error = new Error("Hosted Today API returned an unreadable response.");
    error.code = "hosted_today_unreadable";
    error.status = response.status;
    throw error;
  }
  if (!response.ok || !data?.ok) {
    const error = new Error(data?.error || `Hosted Today request failed (HTTP ${response.status}).`);
    error.code = data?.code || "hosted_today_failed";
    error.status = response.status;
    throw error;
  }
  if (!Array.isArray(data.decisions) || !Array.isArray(data.workState) || !Array.isArray(data.comingUp)) {
    const error = new Error("Hosted Today API returned an invalid inbox contract.");
    error.code = "hosted_today_contract_invalid";
    throw error;
  }
  return data;
}

export function createBrowserHostedTodayDecisionClient({ fetchImpl = globalThis.fetch } = {}) {
  const fetcher = requireFetch(fetchImpl);

  async function listInbox() {
    const response = await fetcher("/api/today/decisions", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });
    const data = await parseResponse(response);
    return Object.freeze({
      workspaceId: required(data.workspaceId, "workspaceId"),
      decisions: data.decisions.map(normalizeDecision),
      workState: data.workState.map(normalizeWorkItem),
      comingUp: data.comingUp.map(normalizeComingUpItem),
    });
  }

  async function listDecisions() {
    return listInbox();
  }

  return Object.freeze({ listInbox, listDecisions });
}

export {
  normalizeDecision as normalizeHostedTodayDecision,
  normalizeWorkItem as normalizeHostedTodayWorkItem,
  normalizeComingUpItem as normalizeHostedTodayComingUpItem,
};
