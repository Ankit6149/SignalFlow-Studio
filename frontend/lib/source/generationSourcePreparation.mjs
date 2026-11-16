import {
  fetchUrlContent,
  sourceArtifactFromFetchResult,
} from "../context/linkFetcher.js";
import { validateSourceGraph } from "../domain/sourceArtifacts.mjs";
import {
  parseSourceLinkCandidates,
  SOURCE_HEALTH_ENTRY_STATUSES,
} from "./sourceHealth.mjs";

export async function prepareRemoteLinkEvidence({
  docsUrl = "",
  sourceWorkspaceId = "request-workspace",
  canonicalSources = { assets: [], sourceArtifacts: [], processingRecords: [] },
  signal = null,
  fetchUrlContentImpl = fetchUrlContent,
} = {}) {
  const linkCandidates = parseSourceLinkCandidates(docsUrl);
  const linkFetchResults = [];
  const linksContext = [];
  const warnings = [];
  let nextSources = canonicalSources;

  const fetchable = linkCandidates.filter(
    (item) => item.status === SOURCE_HEALTH_ENTRY_STATUSES.NEEDS_VERIFICATION,
  );

  for (const candidate of fetchable) {
    const fetchResult = await fetchUrlContentImpl(candidate.canonicalUrl, { signal });
    if (!fetchResult) continue;
    linkFetchResults.push(fetchResult);

    if (fetchResult.evidenceUsable === true) {
      linksContext.push(fetchResult);
      const remoteArtifact = sourceArtifactFromFetchResult(fetchResult, {
        workspaceId: sourceWorkspaceId,
      });
      if (remoteArtifact) {
        nextSources = validateSourceGraph({
          workspaceId: sourceWorkspaceId,
          assets: nextSources.assets,
          sourceArtifacts: [...nextSources.sourceArtifacts, remoteArtifact],
          processingRecords: nextSources.processingRecords,
        });
      }
    }

    if (fetchResult.warnings?.length) warnings.push(...fetchResult.warnings);
  }

  return Object.freeze({
    linkCandidates,
    linkFetchResults: Object.freeze(linkFetchResults),
    linksContext: Object.freeze(linksContext),
    warnings: Object.freeze(Array.from(new Set(warnings))),
    canonicalSources: nextSources,
  });
}
