export const DEFAULT_DESTINATION_CONCURRENCY = 2;

export async function mapWithConcurrency(items, worker, concurrency = DEFAULT_DESTINATION_CONCURRENCY) {
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
      const index = cursor;
      cursor += 1;
      results[index] = await worker(values[index], index);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => runLane()));
  return results;
}
