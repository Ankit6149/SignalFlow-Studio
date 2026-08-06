import { readFile, writeFile } from "node:fs/promises";

const pagePath = "frontend/app/page.js";
const responsivePath = "frontend/app/responsive-studio.css";

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Could not find ${label}`);
  return source.replace(before, after);
}

function replacePattern(source, pattern, after, label) {
  if (!pattern.test(source)) throw new Error(`Could not find ${label}`);
  return source.replace(pattern, after);
}

let page = await readFile(pagePath, "utf8");

page = replaceOnce(
  page,
  `  createSourceSnapshot,
  resolveStudioStage,
  restoreSourceSnapshot,
  selectAcceptedFiles,
} from "../lib/studio/clientReliability.mjs";`,
  `  createSourceSnapshot,
  extractClipboardImageFiles,
  resolveStudioStage,
  restoreSourceSnapshot,
  selectAcceptedFiles,
} from "../lib/studio/clientReliability.mjs";`,
  "client reliability imports",
);

const sourceHandlers = `  async function ingestSourceFiles(pickedFiles, { input = null, source = "upload" } = {}) {
    const picked = Array.from(pickedFiles || []);
    if (!picked.length) return;

    const { accepted, skippedCount } = selectAcceptedFiles(picked, files.length);
    if (!accepted.length) {
      setMessage({ type: "warning", text: "SignalFlow accepts up to 12 source files per campaign. Remove one before adding another." });
      if (input) input.value = "";
      return;
    }

    const nextFiles = [];
    const nextText = [];
    let extractionFailures = 0;
    for (const file of accepted) {
      const isText =
        file.type.startsWith("text/") ||
        /\\.(md|txt|json|csv|log|js|jsx|ts|tsx|py|go|rs|java|cpp|c|h|html|css)$/i.test(file.name);
      let extractedText = "";
      let extractionFailed = false;
      if (isText && file.size <= 500000) {
        try {
          extractedText = (await file.text()).slice(0, 12000);
          nextText.push(\`FILE: \${file.name}\\n\${extractedText}\`);
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

    setFiles((previous) => [...previous, ...nextFiles]);
    setDocumentText((previous) => [...previous, ...nextText]);

    if (skippedCount > 0) {
      setMessage({ type: "warning", text: \`Added \${accepted.length} source\${accepted.length === 1 ? "" : "s"}; skipped \${skippedCount} because the campaign limit is 12.\` });
    } else if (extractionFailures > 0) {
      setMessage({ type: "warning", text: \`Added the sources, but \${extractionFailures} text file\${extractionFailures === 1 ? "" : "s"} could not be extracted in this browser.\` });
    } else if (source === "paste") {
      setMessage({ type: "warning", text: \`Pasted \${accepted.length} image\${accepted.length === 1 ? "" : "s"} as visual references. Add a written brief because visual analysis is not enabled in this route yet.\` });
    } else if (nextText.length === 0) {
      setMessage({ type: "warning", text: "The files were added as asset references only. Add a written brief because visual analysis is not enabled in this route yet." });
    }
    if (input) input.value = "";
  }

  function handleFiles(event) {
    void ingestSourceFiles(event.target.files, { input: event.target, source: "upload" });
  }

  function handleSourcePaste(event) {
    const images = extractClipboardImageFiles(event.clipboardData);
    if (!images.length) return;
    event.preventDefault();
    void ingestSourceFiles(images, { source: "paste" });
  }

  function handleSourceDrop(event) {
    event.preventDefault();
    const dropped = Array.from(event.dataTransfer?.files || []);
    if (!dropped.length) return;
    void ingestSourceFiles(dropped, { source: "drop" });
  }

  function removeFile(index) {`;

page = replacePattern(
  page,
  /  async function handleFiles\(event\) \{[\s\S]*?\n  \}\n\n  function removeFile\(index\) \{/,
  sourceHandlers,
  "source file handlers",
);

page = replaceOnce(
  page,
  `          data-stage={stage}
          data-freshness={campaignFreshness.status}
        >`,
  `          data-stage={stage}
          data-freshness={campaignFreshness.status}
          onPaste={stage === "source" ? handleSourcePaste : undefined}
        >`,
  "Studio main element",
);

page = replaceOnce(
  page,
  `                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {`,
  `                onClick={() => fileInputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "copy";
                }}
                onDrop={handleSourceDrop}
                role="button"
                tabIndex={0}
                aria-label="Add source files by browsing, dropping, or pasting images"
                onKeyDown={(event) => {`,
  "upload zone interactions",
);

page = replaceOnce(
  page,
  `                  <strong>Add source files</strong>
                  <span>Text and code are extracted; images stay honest asset references.</span>`,
  `                  <strong>Drop, browse, or paste source files</strong>
                  <span>Paste screenshots with Ctrl+V or ⌘V. Text and code are extracted; images remain visual asset references.</span>`,
  "upload zone copy",
);

page = replaceOnce(
  page,
  `                  Browse
                </span>`,
  `                  Browse files
                </span>`,
  "upload zone action label",
);

await writeFile(pagePath, page);

let responsive = await readFile(responsivePath, "utf8");
const marker = "/* Wide Studio workspace and clipboard source contract */";
if (!responsive.includes(marker)) {
  responsive += `

${marker}
@media (min-width: 68.01rem) {
  .app-shell .studio-page,
  .app-shell .studio-page[data-stage="source"],
  .app-shell .studio-page[data-stage="destinations"],
  .app-shell .studio-page[data-stage="review"] {
    width: min(112rem, calc(100vw - clamp(2rem, 4vw, 5rem)));
    max-width: none;
  }

  .app-shell .studio-grid:not(.studio-grid--review) {
    grid-template-columns: minmax(0, 1fr);
  }

  .app-shell .studio-grid:not(.studio-grid--review) .output-panel {
    border-left: 0;
  }

  .app-shell .studio-page[data-stage="source"] .composer-panel {
    grid-template-columns: minmax(0, 1.7fr) minmax(22rem, 0.8fr);
    column-gap: clamp(1.75rem, 2.8vw, 3.5rem);
  }

  .app-shell .studio-page[data-stage="destinations"] .output-panel {
    grid-template-columns: minmax(0, 1.75fr) minmax(22rem, 0.72fr);
    gap: 1.75rem clamp(1.75rem, 2.6vw, 3rem);
  }

  .app-shell .studio-page[data-stage="source"] .upload-zone {
    min-height: 8rem;
  }
}

@media (min-width: 88rem) {
  .app-shell .studio-page[data-stage="review"] .review-workspace {
    grid-template-columns: 11rem minmax(0, 1.6fr) minmax(19rem, 0.75fr);
    grid-template-areas:
      "status status status"
      "stale stale stale"
      "tabs nav inspector"
      "tabs editor inspector"
      "tabs editor actions"
      "tabs editor route"
      "tabs notes notes"
      "tabs export export";
    gap: 1rem 1.5rem;
  }

  .app-shell .studio-page[data-stage="review"] .review-tabs,
  .app-shell .studio-page[data-stage="review"] .review-inspector {
    position: sticky;
    top: calc(var(--app-header) + 1.25rem);
    align-self: start;
  }
}

@media (min-width: 96rem) {
  .app-shell .studio-page[data-stage="destinations"] .channel-picker {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
`;
  await writeFile(responsivePath, responsive);
}

console.log("Applied wide Studio workspace and clipboard image support.");
