from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8")


def replace_once(content: str, old: str, new: str, label: str) -> str:
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one anchor, found {count}")
    return content.replace(old, new, 1)


def patch_source_migration() -> None:
    path = "frontend/lib/domain/sourceArtifacts.mjs"
    content = read(path)
    old = '''export function migrateLegacySourceArtifact(input = {}, context = {}) {
  if (input?.kind === "SourceArtifact" && input?.schemaVersion === DOMAIN_SCHEMA_VERSION) {
    return normalizeSourceArtifact(parseDomainRecord(input, "SourceArtifact"), context);
  }
  const requestedKind = text(input.sourceKind || input.artifactType).toLowerCase();
  const legacyKind = SOURCE_KIND_VALUES.has(requestedKind)
    ? requestedKind
    : requestedKind === "note" ? SOURCE_KINDS.NOTE : SOURCE_KINDS.UPLOAD;
  return normalizeSourceArtifact({
    ...input,
    sourceKind: legacyKind,
    ingestionMethod: input.ingestionMethod || INGESTION_METHODS.BROWSER_UPLOAD,
    originalName: input.originalName || input.name,
    mimeType: input.mimeType || input.type,
    byteSize: input.byteSize ?? input.size,
    extraction: input.extraction || {
      state: input.extracted ? PROCESSING_STATES.COMPLETE : PROCESSING_STATES.NOT_REQUESTED,
      charCount: text(input.documentText || input.extractedText).length,
    },
    usability: input.usability || {
      state: input.extracted ? SOURCE_USABILITY_STATES.USABLE_EVIDENCE : SOURCE_USABILITY_STATES.REFERENCE_ONLY,
      evidenceState: input.extracted ? EVIDENCE_STATES.VERIFIED : EVIDENCE_STATES.UNVERIFIED,
      issueCodes: input.extracted ? [] : ["legacy.reference_only"],
    },
    userMetadata: input.userMetadata || { description: input.description },
  }, context);
}
'''
    new = '''export function migrateLegacySourceArtifact(input = {}, context = {}) {
  const source = input?.kind === "SourceArtifact" && input?.schemaVersion === DOMAIN_SCHEMA_VERSION
    ? parseDomainRecord(input, "SourceArtifact")
    : input;
  const requestedKind = text(source.sourceKind || source.artifactType).toLowerCase();
  const legacyKindMap = Object.freeze({
    document: SOURCE_KINDS.UPLOAD,
    image: SOURCE_KINDS.UPLOAD,
    video: SOURCE_KINDS.UPLOAD,
    audio: SOURCE_KINDS.UPLOAD,
    file: SOURCE_KINDS.UPLOAD,
    media: SOURCE_KINDS.UPLOAD,
    webpage: SOURCE_KINDS.LINK,
    page: SOURCE_KINDS.LINK,
    url: SOURCE_KINDS.LINK,
    repo: SOURCE_KINDS.REPOSITORY,
    github: SOURCE_KINDS.REPOSITORY,
  });
  const legacyKind = SOURCE_KIND_VALUES.has(requestedKind)
    ? requestedKind
    : legacyKindMap[requestedKind] || SOURCE_KINDS.UPLOAD;
  return normalizeSourceArtifact({
    ...source,
    sourceKind: legacyKind,
    ingestionMethod: source.ingestionMethod || INGESTION_METHODS.BROWSER_UPLOAD,
    originalName: source.originalName || source.name,
    mimeType: source.mimeType || source.type,
    byteSize: source.byteSize ?? source.size,
    extraction: source.extraction || {
      state: source.extracted ? PROCESSING_STATES.COMPLETE : PROCESSING_STATES.NOT_REQUESTED,
      charCount: text(source.documentText || source.extractedText).length,
    },
    usability: source.usability || {
      state: source.extracted ? SOURCE_USABILITY_STATES.USABLE_EVIDENCE : SOURCE_USABILITY_STATES.REFERENCE_ONLY,
      evidenceState: source.extracted ? EVIDENCE_STATES.VERIFIED : EVIDENCE_STATES.UNVERIFIED,
      issueCodes: source.extracted ? [] : ["legacy.reference_only"],
    },
    userMetadata: source.userMetadata || { description: source.description },
  }, context);
}
'''
    content = replace_once(content, old, new, "legacy source migration")
    write(path, content)


def patch_freshness_compatibility() -> None:
    path = "frontend/lib/studio/campaignFreshness.mjs"
    content = read(path)
    old = '''  const media = sortCanonical(
    (Array.isArray(files) ? files : []).map((file) => sourceArtifactSnapshotReference(
      file?.sourceArtifact || {
        ...file,
        assetId: file?.asset?.assetId || file?.assetId,
      },
      {
        workspaceId: file?.sourceArtifact?.workspaceId || file?.asset?.workspaceId || "browser-local",
        campaignId: file?.sourceArtifact?.campaignId || file?.asset?.campaignId || null,
        now: file?.sourceArtifact?.createdAt || file?.asset?.createdAt || file?.createdAt || new Date(0).toISOString(),
      },
    )),
  );
'''
    new = '''  const media = sortCanonical(
    (Array.isArray(files) ? files : []).map((file) => file?.sourceArtifact
      ? sourceArtifactSnapshotReference(file.sourceArtifact, {
        workspaceId: file.sourceArtifact.workspaceId || file?.asset?.workspaceId || "browser-local",
        campaignId: file.sourceArtifact.campaignId || file?.asset?.campaignId || null,
        now: file.sourceArtifact.createdAt || file?.asset?.createdAt || file?.createdAt || new Date(0).toISOString(),
      })
      : {
        legacySource: true,
        name: normalizeText(file?.name),
        type: normalizeText(file?.type || "file").toLowerCase(),
        size: Math.max(0, Number(file?.size) || 0),
        description: normalizeText(file?.description),
      }),
  );
'''
    content = replace_once(content, old, new, "legacy freshness projection")
    write(path, content)


def consolidate_styles() -> None:
    source_path = ROOT / "frontend/app/source-contract.css"
    target_path = ROOT / "frontend/app/campaign-versioning.css"
    if not source_path.exists():
        raise RuntimeError("canonical source stylesheet is missing")
    source_css = source_path.read_text(encoding="utf-8").strip()
    target_css = target_path.read_text(encoding="utf-8").rstrip()
    marker = "/* Canonical source and asset states */"
    if marker not in target_css:
        target_css = f"{target_css}\n\n{marker}\n{source_css}\n"
        target_path.write_text(target_css, encoding="utf-8")
    source_path.unlink()

    layout_path = "frontend/app/layout.js"
    layout = read(layout_path)
    layout = layout.replace('import "../app/source-contract.css";\n', "")
    write(layout_path, layout)

    test_path = "frontend/tests/sourceArtifactProductIntegration.test.mjs"
    test_content = read(test_path)
    test_content = replace_once(
        test_content,
        '  const css = readFrontend("app/source-contract.css");\n',
        '  const css = readFrontend("app/campaign-versioning.css");\n',
        "source CSS test path",
    )
    write(test_path, test_content)


def apply_final_transfer_corrections() -> None:
    correction_path = ROOT / "scripts/apply-canonical-source-transfer-fixes.py"
    if not correction_path.exists():
        raise RuntimeError("final canonical transfer correction script is missing")
    namespace = {"__name__": "__main__", "__file__": str(correction_path)}
    exec(compile(correction_path.read_text(encoding="utf-8"), str(correction_path), "exec"), namespace)


def main() -> None:
    patch_source_migration()
    patch_freshness_compatibility()
    consolidate_styles()
    apply_final_transfer_corrections()


if __name__ == "__main__":
    main()
