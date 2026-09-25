export const DEFAULT_DESTINATION_CONCURRENCY = 2;
export const LOCAL_DESTINATION_CONCURRENCY = 1;
export const LONG_FORM_DESTINATION_CONCURRENCY = 1;

export const LONG_FORM_DESTINATIONS = Object.freeze([
  "blog",
  "newsletter",
  "youtube",
  "reddit",
]);

function positiveInteger(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

export function resolveDestinationConcurrency({
  isLocalProvider = false,
  configuredConcurrency = null,
} = {}) {
  const providerCeiling = isLocalProvider
    ? LOCAL_DESTINATION_CONCURRENCY
    : DEFAULT_DESTINATION_CONCURRENCY;
  const requested = positiveInteger(configuredConcurrency);
  return requested ? Math.min(providerCeiling, requested) : providerCeiling;
}

export function isLongFormDestination(channel) {
  return LONG_FORM_DESTINATIONS.includes(String(channel || "").trim().toLowerCase());
}

export async function mapWithConcurrency(items, worker, concurrency = DEFAULT_DESTINATION_CONCURRENCY, { signal = null } = {}) {
  const values = Array.isArray(items) ? items : [];
  if (!values.length) return [];
  if (typeof worker !== "function") throw new TypeError("mapWithConcurrency requires a worker function.");

  const limit = Math.max(
    1,
    Math.min(values.length, Number(concurrency) || DEFAULT_DESTINATION_CONCURRENCY),
  );
  const results = new Array(values.length);
  let cursor = 0;

  async function runLane() {
    while (cursor < values.length) {
      if (signal?.aborted) break;
      const index = cursor;
      cursor += 1;
      results[index] = await worker(values[index], index);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => runLane()));
  return results;
}

export async function mapDestinationsWithPolicy(
  items,
  worker,
  {
    isLocalProvider = false,
    configuredConcurrency = null,
    signal = null,
    channelOf = (item) => item,
  } = {},
) {
  const values = Array.isArray(items) ? items : [];
  if (!values.length) return [];
  if (typeof worker !== "function") throw new TypeError("mapDestinationsWithPolicy requires a worker function.");

  const indexed = values.map((value, index) => ({
    value,
    index,
    channel: String(channelOf(value) || "").trim().toLowerCase(),
  }));
  const shortForm = indexed.filter((item) => !isLongFormDestination(item.channel));
  const longForm = indexed.filter((item) => isLongFormDestination(item.channel));
  const output = new Array(values.length);

  const shortConcurrency = resolveDestinationConcurrency({
    isLocalProvider,
    configuredConcurrency,
  });

  const runIndexed = async (item) => {
    const result = await worker(item.value, item.index);
    output[item.index] = result;
    return result;
  };

  await mapWithConcurrency(
    shortForm,
    runIndexed,
    shortConcurrency,
    { signal },
  );

  if (!signal?.aborted) {
    await mapWithConcurrency(
      longForm,
      runIndexed,
      LONG_FORM_DESTINATION_CONCURRENCY,
      { signal },
    );
  }

  return output;
}
