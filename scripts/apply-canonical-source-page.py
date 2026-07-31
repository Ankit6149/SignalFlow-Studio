from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "frontend/app/page.js"
content = PATH.read_text(encoding="utf-8")


def replace_once(old: str, new: str, label: str) -> None:
    global content
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one anchor, found {count}")
    content = content.replace(old, new, 1)


import_marker = 'import { parseCapabilitySnapshot } from "../lib/capabilities/capabilityContract.mjs";\n'
addition = '''import {
  createUploadSourceBundle,
  projectGenerationMediaItem,
} from "../lib/domain/sourceArtifacts.mjs";
'''
if addition.strip() not in content:
    replace_once(import_marker, addition + import_marker, "page canonical source import")

start_marker = "    const nextFiles = [];\n    const nextText = [];\n    let extractionFailures = 0;\n"
end_marker = "\n    setFiles((previous) => [...previous, ...nextFiles]);\n"
start = content.find(start_marker)
if start < 0:
    raise RuntimeError("page upload start marker missing")
end = content.find(end_marker, start)
if end < 0:
    raise RuntimeError("page upload end marker missing")

new_block = '''    const nextFiles = [];
    const nextText = [];
    let extractionFailures = 0;
    for (const file of accepted) {
      const isText =
        file.type.startsWith("text/") ||
        /\.(md|txt|json|csv|log|js|jsx|ts|tsx|py|go|rs|java|cpp|c|h|html|css)$/i.test(file.name);
      let extractedText = "";
      let extractionFailed = false;
      if (isText && file.size <= 500000) {
        try {
          extractedText = (await file.text()).slice(0, 12000);
          nextText.push(`FILE: ${file.name}\n${extractedText}`);
        } catch {
          extractionFailed = true;
          extractionFailures += 1;
        }
      }
      const now = new Date().toISOString();
      const bundle = createUploadSourceBundle({
        file: {
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          clientReferenceId: createClientId("upload"),
          truncated: extractedText.length === 12000,
        },
        extractedText,
        extractionFailed,
        workspaceId: "browser-local",
        campaignId: currentCampaignId || null,
        assetId: createClientId("asset"),
        sourceArtifactId: createClientId("source-artifact"),
        now,
      });
      nextFiles.push({
        name: bundle.sourceArtifact.originalName,
        type: bundle.sourceArtifact.mimeType,
        size: bundle.sourceArtifact.byteSize,
        extracted: bundle.sourceArtifact.extraction.state === "complete",
        description: bundle.sourceArtifact.userMetadata.description,
        asset: bundle.asset,
        sourceArtifact: bundle.sourceArtifact,
        createdAt: now,
      });
    }
'''
content = content[:start] + new_block + content[end:]

old_media = '''        media_items: files.map(({ name, type, size, description }) => ({
          name,
          type,
          size,
          description,
        })),
'''
new_media = '''        assets: files.map((file) => file.asset).filter(Boolean),
        source_artifacts: files.map((file) => file.sourceArtifact).filter(Boolean),
        media_items: files.map((file) => projectGenerationMediaItem(
          file.sourceArtifact || {
            ...file,
            assetId: file.asset?.assetId || file.assetId,
          },
          {
            workspaceId: file.sourceArtifact?.workspaceId || file.asset?.workspaceId || "browser-local",
            campaignId: file.sourceArtifact?.campaignId || file.asset?.campaignId || currentCampaignId || null,
            now: file.sourceArtifact?.createdAt || file.asset?.createdAt || file.createdAt || new Date(0).toISOString(),
          },
        )),
'''
replace_once(old_media, new_media, "page generation source projection")

PATH.write_text(content, encoding="utf-8")
