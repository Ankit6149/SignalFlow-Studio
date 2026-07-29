const ACCEPTED_STATUSES = new Set(["generated", "regenerated", "needs_review", "failed"]);
const RETIRED_MODES = new Set(["template", "template_fallback", "fallback", "offline", "prompt", "prompt_only"]);
const FALLBACK_FLAGS = [
  "fallbackUsed",
  "fallback_used",
  "templateUsed",
  "template_used",
  "usedFallback",
  "used_fallback",
];

export class GenerationResponseError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "GenerationResponseError";
    this.code = code;
  }
}

function reject(code, message) {
  throw new GenerationResponseError(code, message);
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeChannels(value) {
  return Array.from(new Set(
    (Array.isArray(value) ? value : [])
      .map((channel) => String(channel || "").trim().toLowerCase())
      .filter(Boolean),
  ));
}

function assertNoRetiredFallback(response) {
  const fallbackFlag = FALLBACK_FLAGS.find((key) => response[key] === true);
  if (fallbackFlag) {
    reject(
      "fallback_response",
      "SignalFlow refused the response because it contained retired template fallback content.",
    );
  }

  const modes = [
    response.mode,
    response.generation?.mode,
    response.package?.generation?.mode,
  ]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);

  if (modes.some((mode) => RETIRED_MODES.has(mode))) {
    reject(
      "fallback_response",
      "SignalFlow refused the response because its generation mode is not a real model route.",
    );
  }
}

export function acceptGenerationResponse({ response, requestedChannels } = {}) {
  if (!isRecord(response)) {
    reject("malformed_response", "SignalFlow returned an invalid generation response.");
  }

  if (response.ok === false) {
    reject("generation_failed", String(response.error || "SignalFlow could not generate this campaign."));
  }

  assertNoRetiredFallback(response);

  const channels = normalizeChannels(requestedChannels);
  if (!channels.length) {
    reject("missing_channels", "SignalFlow could not verify the requested destination channels.");
  }

  if (!String(response.providerUsed || "").trim()) {
    reject("missing_provider", "SignalFlow returned a campaign without a provider identifier.");
  }

  if (!isRecord(response.package) || !isRecord(response.package.project)) {
    reject("missing_package", "SignalFlow returned an incomplete campaign package.");
  }

  if (!isRecord(response.posts)) {
    reject("missing_posts", "SignalFlow returned a campaign without destination drafts.");
  }

  if (!isRecord(response.generation_status)) {
    reject("missing_generation_status", "SignalFlow returned a campaign without destination generation status.");
  }

  const responseChannels = normalizeChannels(response.channels);
  if (responseChannels.length) {
    const missingResponseChannels = channels.filter((channel) => !responseChannels.includes(channel));
    if (missingResponseChannels.length) {
      reject(
        "incompatible_channels",
        `SignalFlow omitted requested destinations: ${missingResponseChannels.join(", ")}.`,
      );
    }
  }

  const posts = {};
  const failedChannels = [];
  const acceptedChannels = [];

  for (const channel of channels) {
    const statusEntry = response.generation_status[channel];
    const status = String(statusEntry?.status || "").trim().toLowerCase();

    if (!ACCEPTED_STATUSES.has(status)) {
      reject(
        "incompatible_generation_status",
        `SignalFlow returned an unsupported generation status for ${channel || "a destination"}.`,
      );
    }

    if (status === "failed") {
      failedChannels.push(channel);
      continue;
    }

    const draft = response.posts[channel];
    if (typeof draft !== "string" || !draft.trim()) {
      reject(
        "invalid_draft",
        `SignalFlow returned no usable draft for ${channel}.`,
      );
    }

    posts[channel] = draft;
    acceptedChannels.push(channel);
  }

  if (!acceptedChannels.length) {
    reject("no_accepted_drafts", "SignalFlow did not return any usable destination draft.");
  }

  return {
    result: response,
    posts,
    activeChannel: acceptedChannels[0],
    acceptedChannels,
    failedChannels,
  };
}
