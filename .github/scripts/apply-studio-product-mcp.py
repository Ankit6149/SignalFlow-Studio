from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path):
    return (ROOT / path).read_text()


def write(path, value):
    (ROOT / path).write_text(value)


def replace_required(path, old, new, label):
    text = read(path)
    if old not in text:
        raise RuntimeError(f"Missing {label} in {path}")
    write(path, text.replace(old, new, 1))


def replace_between(path, start, end, replacement, label):
    text = read(path)
    start_index = text.find(start)
    end_index = text.find(end, start_index + len(start))
    if start_index < 0 or end_index < 0:
        raise RuntimeError(f"Missing {label} boundaries in {path}")
    write(path, text[:start_index] + replacement + text[end_index:])


PAGE = "frontend/app/page.js"

replace_required(
    PAGE,
    '} from "../lib/studio/clientReliability.mjs";',
    '} from "../lib/studio/clientReliability.mjs";\nimport {\n  evaluateProviderReadiness,\n  pickRecommendedProvider,\n} from "../lib/studio/providerReadiness.mjs";',
    "provider readiness import",
)

replace_between(
    PAGE,
    "const PROVIDERS = [",
    "const FAQS = [",
    '''const PROVIDERS = [
  { id: "gemini", label: "Gemini", hint: "Use a temporary Google AI Studio key or the securely configured server route." },
  { id: "openai", label: "OpenAI", hint: "Use a temporary OpenAI key or the securely configured server route." },
  { id: "claude", label: "Claude", hint: "Use a temporary Anthropic key or the securely configured server route." },
  { id: "openrouter", label: "OpenRouter", hint: "Route generation through a model available in your OpenRouter account." },
  { id: "groq", label: "Groq", hint: "Use a Groq key for fast hosted generation." },
  { id: "custom", label: "Custom gateway", hint: "Use an OpenAI-compatible endpoint and model." },
  { id: "ollama", label: "Ollama", hint: "Use a reachable Ollama endpoint in local or trusted self-hosted deployments." },
  { id: "lmstudio", label: "LM Studio", hint: "Use a reachable LM Studio endpoint in local or trusted self-hosted deployments." },
];

''',
    "model provider list",
)

replace_required(
    PAGE,
    'question: "Can I use my own AI model or no AI at all?",\n    answer:\n      "Yes. SignalFlow includes a deterministic local template route and supports Gemini, OpenAI, Claude, Groq, Ollama, LM Studio, and custom OpenAI-compatible endpoints.",',
    'question: "Can I bring my own model provider?",\n    answer:\n      "Yes. SignalFlow supports Gemini, OpenAI, Claude, OpenRouter, Groq, Ollama, LM Studio, and custom OpenAI-compatible endpoints. Campaign generation requires a real model route.",',
    "landing FAQ model answer",
)

replace_required(PAGE, 'provider: "template",', 'provider: "gemini",', "default provider")
replace_required(
    PAGE,
    '  const [connectionsLoading, setConnectionsLoading] = useState(false);\n  const [accessToken, setAccessToken] = useState("");',
    '  const [connectionsLoading, setConnectionsLoading] = useState(false);\n  const [providerStatuses, setProviderStatuses] = useState({});\n  const [providerStatusLoading, setProviderStatusLoading] = useState(true);\n  const [providerTest, setProviderTest] = useState({ status: "idle", message: "" });\n  const [accessToken, setAccessToken] = useState("");',
    "provider status state",
)
replace_required(PAGE, '  const [showAdvanced, setShowAdvanced] = useState(false);\n', '', "retired advanced state")

replace_required(
    PAGE,
    '  const composeReady = sourceSignals > 0 && channels.length > 0;',
    '''  const providerReadiness = evaluateProviderReadiness({
    provider: form.provider,
    apiKey: form.apiKey,
    baseUrl: form.baseUrl,
    status: providerStatuses[form.provider],
  });
  const sourceAndChannelsReady = sourceSignals > 0 && channels.length > 0;
  const composeReady = sourceAndChannelsReady && providerReadiness.ready;''',
    "provider-aware campaign readiness",
)

replace_required(
    PAGE,
    '  useEffect(() => {\n    if (!entered) return;\n    refreshConnections();\n  }, [entered, accessToken]);',
    '  useEffect(() => {\n    if (!entered) return;\n    refreshConnections();\n    refreshProviderStatus();\n  }, [entered, accessToken]);',
    "provider status refresh effect",
)

replace_required(
    PAGE,
    '  async function syncOwnerSession() {',
    '''  async function refreshProviderStatus() {
    setProviderStatusLoading(true);
    try {
      const response = await fetch("/api/provider_status");
      const data = await readJsonResponse(response, "SignalFlow could not read model provider status.");
      const statuses = data.providers || {};
      setProviderStatuses(statuses);
      const recommended = pickRecommendedProvider({
        defaultProvider: data.defaultProvider,
        statuses,
        fallback: form.provider,
      });
      setForm((previous) => {
        if (previous.apiKey.trim() || previous.baseUrl.trim() || statuses[previous.provider]?.configured) return previous;
        return previous.provider === recommended ? previous : { ...previous, provider: recommended };
      });
    } catch {
      setProviderStatuses({});
    } finally {
      setProviderStatusLoading(false);
    }
  }

  async function testProviderConnection() {
    if (!providerReadiness.ready) {
      setProviderTest({ status: "error", message: providerReadiness.reason });
      return;
    }
    setProviderTest({ status: "testing", message: "Testing model route…" });
    try {
      const response = await fetch("/api/provider_test", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          provider: form.provider,
          modelName: form.model.trim(),
          baseUrl: form.baseUrl.trim(),
          temporaryApiKey: form.apiKey.trim(),
        }),
      });
      const data = await readJsonResponse(response, "SignalFlow returned an unreadable provider test response.");
      if (!response.ok || !data.ok) throw new Error(data.error || "Model route test failed.");
      setProviderTest({ status: "success", message: data.message || "Model route connected successfully." });
      void refreshProviderStatus();
    } catch (error) {
      setProviderTest({ status: "error", message: error.message });
    }
  }

  async function syncOwnerSession() {''',
    "provider functions",
)

replace_required(
    PAGE,
    '    setBusy(true);\n    setMessage(null);',
    '''    if (!providerReadiness.ready) {
      setMessage({ type: "error", text: providerReadiness.reason });
      navigateStudioFlow("destinations");
      return;
    }

    setBusy(true);
    setMessage(null);''',
    "provider guard before generation",
)

replace_required(
    PAGE,
    '''      setMessage({
        type: data.fallbackUsed ? "warning" : "success",
        text: data.fallbackUsed
          ? "Campaign created with a fallback route. Review the generation note before publishing."
          : `Campaign generated with ${data.providerUsed || provider.label}.`,
      });''',
    '''      if (data.fallbackUsed) {
        throw new Error("SignalFlow refused the response because it contained retired template fallback content.");
      }
      const failedChannels = Object.entries(data.generation_status || {})
        .filter(([, item]) => item?.status === "failed")
        .map(([channel]) => channel);
      setMessage({
        type: failedChannels.length ? "warning" : "success",
        text: failedChannels.length
          ? `Campaign generated with ${data.providerUsed || provider.label}; ${failedChannels.join(", ")} failed without template substitution.`
          : `Campaign generated with ${data.providerUsed || provider.label}.`,
      });''',
    "honest generation result",
)

replace_required(
    PAGE,
    '<span className={`connection-light ${accessToken ? "connection-light--on" : ""}`} />\n          <span>{accessToken ? "Owner session" : "Local mode"}</span>',
    '<span className={`connection-light ${providerReadiness.ready ? "connection-light--on" : ""}`} />\n          <span>{providerReadiness.ready ? `${accessToken ? "Owner · " : ""}${provider.label}` : "Model setup needed"}</span>',
    "header model status",
)

replace_between(
    PAGE,
    '              <button\n                className="advanced-toggle"',
    '              {stage === "destinations" ? (',
    '''              <aside className="model-route-panel" aria-label="Model generation route">
                <header className="model-route-panel__header">
                  <div>
                    <div className="model-route-panel__eyebrow">Generation engine</div>
                    <h3>Choose the model route</h3>
                  </div>
                  <span className={`model-route-status ${providerReadiness.ready ? "is-ready" : ""}`}>
                    {providerStatusLoading ? "Checking" : providerReadiness.ready ? "Ready" : "Setup needed"}
                  </span>
                </header>

                <div className="model-provider-grid" role="list" aria-label="Available model providers">
                  {PROVIDERS.map((item) => {
                    const configured = Boolean(providerStatuses[item.id]?.configured);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`model-provider-option ${form.provider === item.id ? "is-selected" : ""}`}
                        onClick={() => {
                          updateForm("provider", item.id);
                          setProviderTest({ status: "idle", message: "" });
                        }}
                        aria-pressed={form.provider === item.id}
                      >
                        <span>{item.label}</span>
                        <small className={configured ? "is-configured" : ""} aria-label={configured ? "Configured on server" : "Not configured on server"} />
                      </button>
                    );
                  })}
                </div>

                <div className="model-route-fields">
                  <label className="field">
                    <span>Audience</span>
                    <input
                      value={form.audience}
                      onChange={(event) => updateForm("audience", event.target.value)}
                    />
                  </label>
                  {!['ollama', 'lmstudio'].includes(form.provider) && (
                    <label className="field">
                      <span>Temporary API key</span>
                      <input
                        type="password"
                        value={form.apiKey}
                        onChange={(event) => updateForm("apiKey", event.target.value)}
                        placeholder={providerStatuses[form.provider]?.configured ? "Server route configured — optional override" : "Required when the server route is not configured"}
                        autoComplete="off"
                      />
                    </label>
                  )}
                  {['ollama', 'lmstudio', 'custom'].includes(form.provider) && (
                    <label className="field">
                      <span>Base URL</span>
                      <input
                        value={form.baseUrl}
                        onChange={(event) => updateForm("baseUrl", event.target.value)}
                        placeholder={form.provider === 'ollama' ? 'http://localhost:11434/v1' : form.provider === 'lmstudio' ? 'http://localhost:1234/v1' : 'https://provider.example/v1'}
                      />
                    </label>
                  )}
                  <label className="field">
                    <span>Model override</span>
                    <input
                      value={form.model}
                      onChange={(event) => updateForm("model", event.target.value)}
                      placeholder={providerStatuses[form.provider]?.defaultModel || "Leave blank for the provider default"}
                    />
                  </label>
                </div>

                <div className="model-route-actions">
                  <button
                    type="button"
                    className="button button--outline"
                    onClick={testProviderConnection}
                    disabled={providerTest.status === "testing" || !providerReadiness.ready}
                  >
                    {providerTest.status === "testing" ? "Testing…" : "Test connection"}
                  </button>
                </div>
                <p className={`model-route-message ${providerTest.status === "error" ? "is-error" : ""}`}>
                  {providerTest.status === "idle" ? providerReadiness.reason : providerTest.message}
                </p>
                <p className="model-route-note">
                  Temporary keys are sent only with this request. SignalFlow does not save them in the campaign library.
                </p>
              </aside>

''',
    "always-visible model route panel",
)

replace_required(
    PAGE,
    '<h3>{composeReady ? "Ready to shape the campaign." : "Bring one strong source signal."}</h3>',
    '<h3>{!sourceAndChannelsReady ? "Choose source and destinations." : providerReadiness.ready ? "Ready to shape the campaign." : "Connect a model route."}</h3>',
    "readiness heading",
)
replace_required(
    PAGE,
    '<b className={composeReady ? "is-ready" : ""}>{composeReady ? "Ready" : "Needs source"}</b>',
    '<b className={composeReady ? "is-ready" : ""}>{composeReady ? "Ready" : providerReadiness.ready ? "Needs source" : "Needs model"}</b>',
    "readiness badge",
)
replace_required(
    PAGE,
    '''{composeReady
                        ? form.provider === "template"
                          ? "Ready to test the workflow. Local sample mode is deterministic and intentionally limited; choose a model provider for production-quality content."
                          : "SignalFlow has enough context to build editable drafts. You remain in control of every output and publishing step."
                        : "Add a brief, public link, repository, or extractable text file. Keep the first run simple; advanced model controls can stay closed."}''',
    '''{!sourceAndChannelsReady
                        ? "Add product evidence and select at least one destination."
                        : providerReadiness.ready
                          ? "SignalFlow has enough context and a real model route to build editable drafts."
                          : providerReadiness.reason}''',
    "readiness description",
)

LAYOUT = "frontend/app/layout.js"
replace_required(
    LAYOUT,
    'import "../app/ui-containment.css";',
    'import "../app/ui-containment.css";\nimport "../app/studio-product.css";',
    "final studio stylesheet import",
)
replace_required(
    LAYOUT,
    'question: "Can I use my own AI model or no AI at all?",\n    answer:\n      "Yes. SignalFlow includes a deterministic local template route and supports Gemini, OpenAI, Claude, Groq, Ollama, LM Studio, and custom OpenAI-compatible endpoints.",',
    'question: "Can I bring my own model provider?",\n    answer:\n      "Yes. SignalFlow supports Gemini, OpenAI, Claude, OpenRouter, Groq, Ollama, LM Studio, and custom OpenAI-compatible endpoints. Campaign generation requires a real model route.",',
    "structured FAQ model answer",
)
replace_required(
    LAYOUT,
    'It supports local templates, bring-your-own-model generation, browser-local campaign saving, Markdown and JSON exports, and confirmed-only publishing through configured official connectors.',
    'It supports real model-provider generation, browser-local campaign saving, Markdown and JSON exports, an MCP server for AI agents, and confirmed-only publishing through configured official connectors.',
    "software description",
)
replace_required(
    LAYOUT,
    '        "Use deterministic local templates without an API key",\n',
    '        "Use a real configured or bring-your-own model provider",\n        "Create campaigns directly through the SignalFlow MCP server",\n',
    "schema feature list",
)

write(
    "frontend/app/api/provider_status/route.js",
    '''import { getProviderConfigurationStatus } from "../../../lib/ai/providerStatus";
import { MODEL_GENERATION_PROVIDERS } from "../../../lib/ai/generationPolicy.mjs";

export async function GET() {
  try {
    const allProviders = getProviderConfigurationStatus();
    const providers = Object.fromEntries(
      Object.entries(allProviders).filter(([id]) => MODEL_GENERATION_PROVIDERS.has(id)),
    );
    const requestedDefault = String(process.env.DEFAULT_MODEL_PROVIDER || "").trim().toLowerCase();
    const defaultProvider = MODEL_GENERATION_PROVIDERS.has(requestedDefault) ? requestedDefault : "";
    const recommendedProvider =
      (defaultProvider && providers[defaultProvider]?.configured ? defaultProvider : "") ||
      Object.keys(providers).find((id) => providers[id]?.configured) ||
      "gemini";

    return new Response(JSON.stringify({ providers, defaultProvider, recommendedProvider }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
''',
)

replace_required(
    "frontend/app/api/launch_kit/route.js",
    'import { generateStudioPackage } from "../../../lib/ai/generateStudioPackage";',
    'import { generateStudioPackage } from "../../../lib/ai/generateStudioPackage";\nimport { assertModelGenerationProvider } from "../../../lib/ai/generationPolicy.mjs";',
    "launch route generation policy import",
)
replace_required(
    "frontend/app/api/launch_kit/route.js",
    '    const generator = normalizeTextInput(body.generator) || "template";\n    const providerApiKey = normalizeTextInput(body.providerApiKey);',
    '''    const requestedGenerator = normalizeTextInput(body.generator) || normalizeTextInput(process.env.DEFAULT_MODEL_PROVIDER);
    let generator;
    try {
      generator = assertModelGenerationProvider(requestedGenerator);
    } catch (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const providerApiKey = normalizeTextInput(body.providerApiKey);''',
    "launch route provider requirement",
)
replace_required(
    "frontend/app/api/launch_kit/route.js",
    '      if (generator !== "template" && generator !== "offline" && !providerApiKey) {',
    '      if (!providerApiKey) {',
    "hosted BYO provider gate",
)

write(
    "frontend/app/api/provider_test/route.js",
    '''import { requireOwnerAccess } from "../_auth";
import { generateText } from "../../../lib/ai/generateText";
import { assertModelGenerationProvider } from "../../../lib/ai/generationPolicy.mjs";

const OWNER_ONLY_ENDPOINT_PROVIDERS = new Set(["custom", "ollama", "lmstudio"]);

export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  let provider;
  try {
    provider = assertModelGenerationProvider(body.provider);
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const temporaryApiKey = String(body.temporaryApiKey || "").trim();
  const accessError = requireOwnerAccess(request);
  if (accessError && (OWNER_ONLY_ENDPOINT_PROVIDERS.has(provider) || !temporaryApiKey)) {
    return accessError;
  }

  const modelName = String(body.modelName || "").trim();
  const baseUrl = String(body.baseUrl || "").trim();
  const config = { apiKey: temporaryApiKey, baseUrl, modelName, maxTokens: 64 };

  try {
    await generateText({
      provider,
      prompt: 'Return only JSON: {"ok":true}',
      modelOverride: modelName,
      config,
    });
    return new Response(JSON.stringify({
      ok: true,
      provider,
      configured: true,
      modelUsed: modelName,
      message: "Connection successful.",
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({
      ok: false,
      provider,
      modelUsed: modelName,
      error: error.message,
      setupHint: getSetupHint(provider),
    }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
}

function getSetupHint(provider) {
  switch (provider) {
    case "gemini": return "Add a temporary Gemini key or configure GEMINI_API_KEY.";
    case "openai": return "Add a temporary OpenAI key or configure OPENAI_API_KEY.";
    case "claude": return "Add a temporary Anthropic key or configure ANTHROPIC_API_KEY.";
    case "groq": return "Add a temporary Groq key or configure GROQ_API_KEY.";
    case "openrouter": return "Add a temporary OpenRouter key or configure OPENROUTER_API_KEY.";
    case "custom": return "Configure a trusted OpenAI-compatible base URL and credentials.";
    case "ollama": return "Run SignalFlow where it can reach Ollama and load the requested model.";
    case "lmstudio": return "Run SignalFlow where it can reach LM Studio and load the requested model.";
    default: return "Configure the selected model provider.";
  }
}
''',
)

NORMALIZE = "frontend/lib/package/normalizePackage.js"
replace_required(
    NORMALIZE,
    '/** Ensures every provider response is complete and safe for the active UI. */\nexport function normalizePackage(rawPackage, inputs) {\n  const baseline = generateLocalTemplatePackage(inputs).package;',
    '''function strictBaseline(inputs = {}) {
  return {
    project: {
      name: String(inputs.projectName || "SignalFlow campaign"),
      oneLine: "",
      description: String(inputs.notes || ""),
      audience: String(inputs.audience || ""),
      category: "",
      stage: "",
    },
    context: {
      confirmedFacts: [], inferredFacts: [], missingContext: [], features: [], techStack: [],
      repoInsights: [], docsInsights: [], linkInsights: [], mediaInsights: [],
    },
    strategy: {
      coreAngle: "", positioning: "", hooks: [], proofPoints: [], risks: [], safeClaims: [], avoidClaims: [],
    },
    posts: {
      linkedin: { title: "", body: "", hashtags: [], cta: "" },
      x: { mode: "post_or_thread", posts: [] },
      instagram: { caption: "", hashtags: [], visualDirection: "" },
      reddit: { title: "", body: "", subredditSuggestions: [] },
      facebook: { body: "" },
      threads: { body: "" },
      youtube: { title: "", description: "", tags: [] },
      tiktok: { caption: "", hook: "", shotList: [] },
      hackernews: { title: "", body: "" },
      blog: { title: "", outline: [], draft: "" },
      newsletter: { subject: "", preview: "", body: "" },
      releaseNotes: { title: "", sections: [] },
    },
    media: {
      screenshotPlan: [], videoScript: [], voiceoverScript: [], shotList: [], recordingGuide: [],
      carouselPlan: [], thumbnailIdeas: [], videoTimeline: [], altText: [], assetChecklist: [],
      videoPrompt: "", thumbnailPrompt: "",
    },
    publishing: { platformChecklist: [], manualPostingSteps: [], apiPublishingNotes: "", warnings: [] },
  };
}

/** Ensures provider responses match the active UI contract. */
export function normalizePackage(rawPackage, inputs, { allowTemplateFallback = true } = {}) {
  const baseline = allowTemplateFallback ? generateLocalTemplatePackage(inputs).package : strictBaseline(inputs);''',
    "strict normalization baseline",
)
replace_required(
    NORMALIZE,
    '  if (!normalized.media.videoPrompt) {\n    normalized.media.videoPrompt = buildVideoPrompt(normalized);\n  }',
    '  if (allowTemplateFallback && !normalized.media.videoPrompt) {\n    normalized.media.videoPrompt = buildVideoPrompt(normalized);\n  }',
    "strict media fallback",
)

GEN = "frontend/lib/ai/generateStudioPackage.js"
replace_required(
    GEN,
    'import { PROVIDERS } from "./types";',
    'import { PROVIDERS } from "./types";\nimport { assertModelGenerationProvider } from "./generationPolicy.mjs";',
    "generation policy import",
)
replace_required(
    GEN,
    '  const normalized = normalizePackage({ posts: { [packageKey]: rawDraft } }, generationInputs);',
    '  const normalized = normalizePackage({ posts: { [packageKey]: rawDraft } }, generationInputs, { allowTemplateFallback: false });',
    "strict destination normalization",
)
replace_required(
    GEN,
    'async function generateDestination({',
    '''function emptyDestinationDraft(channel) {
  switch (channel) {
    case "linkedin": return { title: "", body: "", hashtags: [], cta: "" };
    case "x": return { mode: "post_or_thread", posts: [] };
    case "instagram": return { caption: "", hashtags: [], visualDirection: "" };
    case "reddit": return { title: "", body: "", subredditSuggestions: [] };
    case "youtube": return { title: "", description: "", tags: [] };
    case "tiktok": return { caption: "", hook: "", shotList: [] };
    case "hackernews": return { title: "", body: "" };
    case "newsletter": return { subject: "", preview: "", body: "" };
    case "blog": return { title: "", outline: [], draft: "" };
    case "release_notes": return { title: "", sections: [] };
    default: return { body: "" };
  }
}

function emptyPackagePosts() {
  return {
    linkedin: emptyDestinationDraft("linkedin"),
    x: emptyDestinationDraft("x"),
    instagram: emptyDestinationDraft("instagram"),
    reddit: emptyDestinationDraft("reddit"),
    facebook: emptyDestinationDraft("facebook"),
    threads: emptyDestinationDraft("threads"),
    youtube: emptyDestinationDraft("youtube"),
    tiktok: emptyDestinationDraft("tiktok"),
    hackernews: emptyDestinationDraft("hackernews"),
    newsletter: emptyDestinationDraft("newsletter"),
    blog: emptyDestinationDraft("blog"),
    releaseNotes: emptyDestinationDraft("release_notes"),
  };
}

async function generateDestination({''',
    "empty destination structures",
)
replace_required(
    GEN,
    '''  } catch (error) {
    const fallback = normalizePackage({}, generationInputs).posts[packageKey];
    return {
      channel,
      packageKey,
      draft: fallback,
      status: {
        status: "template_fallback",
        attempts: firstDraft ? 1 : 0,
        qualityScore: firstQuality?.score ?? null,
        issues: [`Destination generation failed: ${error.message}`],
      },
    };
  }''',
    '''  } catch (error) {
    return {
      channel,
      packageKey,
      draft: emptyDestinationDraft(channel),
      status: {
        status: "failed",
        attempts: firstDraft ? 1 : 0,
        qualityScore: firstQuality?.score ?? null,
        issues: [`Destination generation failed: ${error.message}`],
      },
    };
  }''',
    "destination failure without template",
)
replace_required(GEN, '    generator = "template",', '    generator: requestedGenerator = "",', "strict generator input")
replace_required(
    GEN,
    '  const generationInputs = {',
    '  const generator = assertModelGenerationProvider(requestedGenerator);\n\n  const generationInputs = {',
    "resolved generation provider",
)
replace_between(
    GEN,
    '  if (generator === "prompt") {',
    '  const temporaryKey = Boolean(config?.apiKey);',
    '''  const providerMeta = PROVIDERS[generator];
  if (!providerMeta) {
    throw new Error(`Unsupported model provider: ${generator}.`);
  }

''',
    "retired prompt and template routes",
)
replace_between(
    GEN,
    '  if (!configured) {',
    '  const modelOverride = model_name || config?.modelName || providerMeta.defaultModel;',
    '''  if (!configured) {
    const requirement = generator === "custom"
      ? "an OpenAI-compatible base URL"
      : (providerMeta.requiredEnv || []).join(" or ") || "provider credentials";
    throw new Error(`${providerMeta.label} is not configured. Add ${requirement} or a temporary personal key.`);
  }

''',
    "unconfigured provider failure",
)
replace_required(
    GEN,
    '    const pkg = normalizePackage(rawBrief, generationInputs);\n    pkg.strategy.destinationAngles = rawBrief?.strategy?.destinationAngles || {};',
    '    const pkg = normalizePackage(rawBrief, generationInputs, { allowTemplateFallback: false });\n    pkg.strategy.destinationAngles = rawBrief?.strategy?.destinationAngles || {};\n    pkg.posts = emptyPackagePosts();',
    "strict campaign package",
)
replace_required(
    GEN,
    '      pkg.posts[result.packageKey] = result.draft;\n      generationStatus[result.channel] = result.status;\n      if (result.status.status === "template_fallback") {\n        generationWarnings.push(`${result.channel}: model generation failed, so deterministic fallback copy is shown.`);\n      } else if (result.status.status === "needs_review") {',
    '      if (result.status.status !== "failed") pkg.posts[result.packageKey] = result.draft;\n      generationStatus[result.channel] = result.status;\n      if (result.status.status === "failed") {\n        generationWarnings.push(`${result.channel}: model generation failed and no substitute copy was inserted.`);\n      } else if (result.status.status === "needs_review") {',
    "honest destination status",
)
replace_required(
    GEN,
    '    pkg.generation = {',
    '''    const failedDestinations = generatedDestinations.filter((item) => item.status.status === "failed");
    if (failedDestinations.length === generatedDestinations.length) {
      throw new Error(`Every selected destination failed: ${failedDestinations.map((item) => item.channel).join(", ")}.`);
    }

    pkg.generation = {''',
    "all destination failure gate",
)
replace_required(
    GEN,
    '    const fallbackUsed = generatedDestinations.some((item) => item.status.status === "template_fallback");',
    '    const partialFailureUsed = failedDestinations.length > 0;',
    "partial failure flag",
)
replace_required(
    GEN,
    '      fallbackUsed,\n      partialFallbackUsed: fallbackUsed,',
    '      fallbackUsed: false,\n      partialFailureUsed,',
    "no fallback response",
)
replace_between(
    GEN,
    '  } catch (error) {\n    const result = templateResult(',
    '\n  }\n}',
    '''  } catch (error) {
    throw new Error(`${providerMeta.label} campaign generation failed: ${error.message}`);
''',
    "strategy failure without template",
)

CI = ".github/workflows/ci.yml"
ci = read(CI)
if "mcp-tests:" not in ci:
    marker = "jobs:\n"
    job = '''jobs:
  mcp-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: "22"
      - name: Run MCP protocol and tool tests
        working-directory: mcp
        run: npm test

'''
    if marker not in ci:
        raise RuntimeError("Missing CI jobs marker")
    ci = ci.replace(marker, job, 1)
    write(CI, ci)

print("Applied Studio product, strict model generation, and MCP integration changes.")
