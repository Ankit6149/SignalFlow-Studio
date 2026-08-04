from pathlib import Path
import re
from textwrap import dedent


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"Expected exactly one {label}; found {count}")
    return source.replace(old, new, 1)


def replace_regex(source: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, source, count=1, flags=re.DOTALL)
    if count != 1:
        raise RuntimeError(f"Expected exactly one {label}; found {count}")
    return updated


zip_path = Path("frontend/lib/export/campaignZip.mjs")
source = zip_path.read_text(encoding="utf-8")
source = replace_once(
    source,
    'function byteLength(value) {\n  return Buffer.byteLength(value, "utf8");\n}',
    'function byteLength(value) {\n  return new TextEncoder().encode(value).byteLength;\n}',
    "ZIP byte counter",
)
source = replace_once(source, '      type: "nodebuffer",', '      type: "uint8array",', "browser-safe ZIP output")
zip_path.write_text(source, encoding="utf-8")

campaign_path = Path("frontend/lib/domain/campaign.mjs")
source = campaign_path.read_text(encoding="utf-8")
old = dedent('''
function stripDuplicateGenerationFields(result = {}) {
  if (!result || typeof result !== "object" || Array.isArray(result)) return {};
  const {
    posts,
    markdown,
    json,
    chatbot_prompt: chatbotPrompt,
    package: pkg,
    ...rest
  } = result;
  void posts;
  void markdown;
  void json;
  void chatbotPrompt;
  return portableClone({
    ...rest,
    package: stripActiveDraftsFromPackage(pkg),
  });
}
''').strip()
new = dedent('''
function stripDuplicateGenerationFields(result = {}) {
  if (!result || typeof result !== "object" || Array.isArray(result)) return {};
  const {
    posts,
    markdown,
    json,
    chatbot_prompt: chatbotPrompt,
    package: pkg,
    structuredPosts: existingStructuredPosts,
    ...rest
  } = result;
  void posts;
  void markdown;
  void json;
  void chatbotPrompt;
  const structuredPosts = pkg?.posts || existingStructuredPosts || {};
  return portableClone({
    ...rest,
    structuredPosts,
    package: stripActiveDraftsFromPackage(pkg),
  });
}
''').strip()
source = replace_once(source, old, new, "structured generation storage")
source = replace_once(
    source,
    '        generation_status: Object.fromEntries(Object.entries(parsed.drafts || {}).map(([channel, draft]) => [channel, { status: draft.qualityState || "generated" }])),',
    dedent('''
        generation_status: {
          ...(parsed.generationResult?.generation_status || {}),
          ...Object.fromEntries(Object.entries(parsed.drafts || {}).map(([channel, draft]) => [channel, { status: draft.qualityState || "generated" }])),
        },
    ''').rstrip(),
    "canonical migration status preservation",
)
source = replace_once(
    source,
    '    generation_status: Object.fromEntries(Object.entries(channelStates).map(([channel, state]) => [channel, { status: state.status }])),',
    dedent('''
    generation_status: {
      ...(campaign.generationResult?.generation_status || {}),
      ...Object.fromEntries(Object.entries(channelStates).map(([channel, state]) => [channel, { status: state.status }])),
    },
    ''').rstrip(),
    "editor status restoration",
)
source = replace_once(
    source,
    '? { ...campaign.generationResult.package, posts: {} }',
    '? { ...campaign.generationResult.package, posts: portableClone(campaign.generationResult?.structuredPosts || {}) }',
    "editor structured restoration",
)
campaign_path.write_text(source, encoding="utf-8")

export_path = Path("frontend/lib/export/campaignExport.mjs")
source = export_path.read_text(encoding="utf-8")
helper = dedent('''

function structuredPostForChannel(posts = {}, channel) {
  if (!posts || typeof posts !== "object" || Array.isArray(posts)) return null;
  if (channel === "hackernews") return posts.hackernews || posts.hn || null;
  if (channel === "release_notes") return posts.releaseNotes || posts.release_notes || null;
  return posts[channel] || null;
}
''')
source = replace_once(source, '\nfunction listSection(title, values) {', f'{helper}\nfunction listSection(title, values) {{', "structured export helper")
source = replace_once(
    source,
    '        generationRunId: draft.generationRunId || null,\n        updatedAt: draft.updatedAt,',
    dedent('''
        generationRunId: draft.generationRunId || null,
        updatedAt: draft.updatedAt,
        structuredDraft: structuredPostForChannel(campaign.generationResult?.structuredPosts, channel),
        structuredDraftOrigin: structuredPostForChannel(campaign.generationResult?.structuredPosts, channel)
          ? "generation_snapshot"
          : null,
    ''').rstrip(),
    "current draft structured projection",
)
export_path.write_text(source, encoding="utf-8")

page_path = Path("frontend/app/page.js")
source = page_path.read_text(encoding="utf-8")
helper = dedent('''

function downloadBinary(filename, value, type = "application/octet-stream") {
  const blob = new Blob([value], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
''')
source = replace_once(source, '\nconst SOURCE_STATE_PRESENTATION = Object.freeze({', f'{helper}\nconst SOURCE_STATE_PRESENTATION = Object.freeze({{', "binary download helper")
export_zip = dedent('''

  async function exportZip() {
    if (campaignStatus.exportBlockedReason) {
      setMessage({ type: "warning", text: campaignStatus.exportBlockedReason });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const projection = await campaignApplication.projectZip(currentCampaignInput());
      downloadBinary(projection.filename, projection.content, projection.mimeType);
      const exportedAt = new Date().toISOString();
      dispatchCampaign({ type: "MARK_EXPORTED", payload: { exportedAt } });
      const failedChannels = projection.summary?.failedChannels || [];
      setMessage({
        type: failedChannels.length ? "warning" : "success",
        text: failedChannels.length
          ? `ZIP exported with ${projection.summary.channelCount} destinations. ${failedChannels.map((channel) => channelMeta(channel).label).join(", ")} are included with explicit failure status instead of substitute content.`
          : `ZIP exported with ${projection.summary.channelCount} destinations and ${projection.summary.fileCount} files.`,
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: `SignalFlow could not build the ZIP archive. Your current drafts are unchanged. ${error.message || "Try Markdown or JSON export instead."}`,
      });
    } finally {
      setBusy(false);
    }
  }
''')
source = replace_once(source, '\n  async function publishCurrentPost() {', f'{export_zip}\n  async function publishCurrentPost() {{', "active ZIP export action")
button_pattern = re.escape('<button onClick={exportMarkdown} disabled={Boolean(campaignStatus.exportBlockedReason)} title={campaignStatus.exportBlockedReason || undefined}>Markdown</button>') + r'\s*' + re.escape('<button onClick={exportJson} disabled={Boolean(campaignStatus.exportBlockedReason)} title={campaignStatus.exportBlockedReason || undefined}>JSON</button>')
button_replacement = dedent('''
<button onClick={exportMarkdown} disabled={busy || Boolean(campaignStatus.exportBlockedReason)} title={campaignStatus.exportBlockedReason || undefined}>Markdown</button>
<button onClick={exportJson} disabled={busy || Boolean(campaignStatus.exportBlockedReason)} title={campaignStatus.exportBlockedReason || undefined}>JSON</button>
<button onClick={() => void exportZip()} disabled={busy || Boolean(campaignStatus.exportBlockedReason)} title={campaignStatus.exportBlockedReason || undefined}>{busy ? "Preparing…" : "ZIP"}</button>
''').strip()
source = replace_regex(source, button_pattern, button_replacement, "Review export controls")
page_path.write_text(source, encoding="utf-8")

css_path = Path("frontend/app/app-workspace.css")
source = css_path.read_text(encoding="utf-8")
source = replace_once(
    source,
    '  grid-template-columns: minmax(0, 1fr) auto auto;\n  align-items: center;\n  gap: 0.65rem;\n  background: var(--app-surface-subtle);',
    '  grid-template-columns: minmax(0, 1fr) repeat(3, auto);\n  align-items: center;\n  gap: 0.65rem;\n  background: var(--app-surface-subtle);',
    "three-format export layout",
)
css_path.write_text(source, encoding="utf-8")

for temporary in [
    Path("scripts/apply_weekend_zip_ui.py"),
    Path(".github/workflows/apply-weekend-zip-ui.yml"),
    Path(".github/workflows/apply-weekend-zip-pr.yml"),
]:
    if temporary.exists():
        temporary.unlink()
