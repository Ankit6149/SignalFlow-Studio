import {
  createRemoteSourceFetcher,
  SOURCE_FETCH_STATUSES,
} from "./remoteSourceFetcher.mjs";

let defaultFetcher = null;

function getDefaultFetcher() {
  if (!defaultFetcher) defaultFetcher = createRemoteSourceFetcher();
  return defaultFetcher;
}

function warningForResult(result) {
  if (!result || result.status === SOURCE_FETCH_STATUSES.USABLE_EVIDENCE) return [];
  const issue = result.issues?.[0];
  return [issue?.message || "Remote source could not be used as evidence."];
}

export async function fetchUrlContent(urlStr, {
  fetcher = getDefaultFetcher(),
  signal = null,
} = {}) {
  if (!urlStr) return null;
  const result = await fetcher.fetchSource(urlStr, { signal });
  return Object.freeze({
    ...result,
    url: result.finalCanonicalUrl || result.canonicalUrl || null,
    warnings: Object.freeze(warningForResult(result)),
  });
}

export {
  createRemoteSourceFetcher,
  SOURCE_FETCH_STATUSES,
};
