import { parseCapabilitySnapshot } from "../../frontend/lib/capabilities/capabilityContract.mjs";
import {
  projectGenerationMediaItem,
  validateSourceGraph,
} from "../../frontend/lib/domain/sourceArtifacts.mjs";
import { signalFlowRequest } from "./httpClient.mjs";
import { campaignExecutionRegistry } from "./executionRegistry.mjs";
import { GENERATION_LIMITS } from "../../frontend/lib/package/generationLimits.mjs";
import { validateGenerationInputs } from "../../frontend/lib/package/validatePackage.js";

const CHANNELS = [
  "linkedin",
  "x",
  "instagram",
  "facebook",
  "threads",
  "reddit",
  "hackernews",
  "youtube",
  "tiktok",
  "newsletter",
  "blog",
  "release_notes",
];

const PROVIDERS = ["gemini", "openai", "claude", "openrouter", "groq", "custom", "ollama", "lmstudio"];

export const TOOL_DEFINITIONS = [
  {
    name: "signalflow_capabilities",
    description: "Inspect the connected SignalFlow deployment profile, session permissions, and truthful feature availability before choosing a workflow.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "signalflow_provider_status",
    description: "Inspect which real model providers are configured for the connected SignalFlow workspace.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "signalflow_test_provider",
    description: "Test the selected SignalFlow model route before generating a campaign. Secrets are read from the MCP server environment, not model context.",
    inputSchema: {
      type: "object",
      required: ["provider"],
      properties: {
        provider: { type: "string", enum: PROVIDERS },
        modelName: { type: "string" },
        baseUrl: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "signalflow_validate_campaign_input",
    description: "Validate SignalFlow campaign inputs, shared generation limits, and canonical source relationships without calling a model or creating campaign work.",
    inputSchema: {
      type: "object",
      properties: {
        projectName: { type: "string", maxLength: GENERATION_LIMITS.projectNameChars },
        notes: { type: "string", maxLength: GENERATION_LIMITS.notesChars },
        audience: { type: "string", maxLength: GENERATION_LIMITS.audienceChars },
        links: { type: "string", maxLength: GENERATION_LIMITS.linksChars },
        repository: { type: "string" },
        channels: {
          type: "array",
          maxItems: GENERATION_LIMITS.channels,
          uniqueItems: true,
          items: { type: "string", enum: CHANNELS },
        },
        documentText: {
          type: "array",
          maxItems: GENERATION_LIMITS.documentItems,
          items: { type: "string", maxLength: GENERATION_LIMITS.documentChars },
        },
        assets: {
          type: "array",
          maxItems: GENERATION_LIMITS.sourceRecordsPerKind,
          items: { type: "object", additionalProperties: true },
        },
        sourceArtifacts: {
          type: "array",
          maxItems: GENERATION_LIMITS.sourceRecordsPerKind,
          items: { type: "object", additionalProperties: true },
        },
        processingRecords: {
          type: "array",
          maxItems: GENERATION_LIMITS.sourceRecordsPerKind,
          items: { type: "object", additionalProperties: true },
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "signalflow_start_campaign",
    description: "Start campaign generation as trackable MCP work and return immediately with a job ID. Use campaign status and cancel tools while generation continues.",
    inputSchema: {
      type: "object",
      required: ["projectName", "notes", "provider", "channels"],
      properties: {
        projectName: { type: "string", minLength: 1, maxLength: GENERATION_LIMITS.projectNameChars },
        notes: { type: "string", minLength: 1, maxLength: GENERATION_LIMITS.notesChars },
        audience: { type: "string", maxLength: GENERATION_LIMITS.audienceChars },
        links: { type: "string", maxLength: GENERATION_LIMITS.linksChars },
        repository: { type: "string" },
        provider: { type: "string", enum: PROVIDERS },
        modelName: { type: "string" },
        baseUrl: { type: "string" },
        channels: {
          type: "array",
          minItems: 1,
          maxItems: GENERATION_LIMITS.channels,
          uniqueItems: true,
          items: { type: "string", enum: CHANNELS },
        },
        documentText: {
          type: "array",
          maxItems: GENERATION_LIMITS.documentItems,
          items: { type: "string", maxLength: GENERATION_LIMITS.documentChars },
        },
        assets: {
          type: "array",
          maxItems: GENERATION_LIMITS.sourceRecordsPerKind,
          items: { type: "object", additionalProperties: true },
        },
        sourceArtifacts: {
          type: "array",
          maxItems: GENERATION_LIMITS.sourceRecordsPerKind,
          items: { type: "object", additionalProperties: true },
        },
        processingRecords: {
          type: "array",
          maxItems: GENERATION_LIMITS.sourceRecordsPerKind,
          items: { type: "object", additionalProperties: true },
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "signalflow_campaign_status",
    description: "Inspect a trackable SignalFlow MCP campaign job without blocking unrelated MCP requests.",
    inputSchema: {
      type: "object",
      required: ["jobId"],
      properties: { jobId: { type: "string", minLength: 1 } },
      additionalProperties: false,
    },
  },
  {
    name: "signalflow_cancel_campaign",
    description: "Request cancellation of queued or active SignalFlow MCP campaign work.",
    inputSchema: {
      type: "object",
      required: ["jobId"],
      properties: { jobId: { type: "string", minLength: 1 } },
      additionalProperties: false,
    },
  },
  {
    name: "signalflow_create_campaign",
    description: "Create a staged, destination-specific SignalFlow campaign from product evidence. This requires a real model provider and never uses local template copy.",
    inputSchema: {
      type: "object",
      required: ["projectName", "notes", "provider", "channels"],
      properties: {
        projectName: { type: "string", minLength: 1, maxLength: GENERATION_LIMITS.projectNameChars },
        notes: { type: "string", minLength: 1, maxLength: GENERATION_LIMITS.notesChars },
        audience: { type: "string", maxLength: GENERATION_LIMITS.audienceChars },
        links: {
          description: "Public documentation, landing pages, or research URLs separated by spaces or new lines.",
          type: "string",
          maxLength: GENERATION_LIMITS.linksChars,
        },
        repository: { type: "string" },
        provider: { type: "string", enum: PROVIDERS },
        modelName: { type: "string" },
        baseUrl: { type: "string" },
        channels: {
          type: "array",
          minItems: 1,
          maxItems: GENERATION_LIMITS.channels,
          uniqueItems: true,
          items: { type: "string", enum: CHANNELS },
        },
        documentText: {
          type: "array",
          maxItems: GENERATION_LIMITS.documentItems,
          items: { type: "string", maxLength: GENERATION_LIMITS.documentChars },
        },
        assets: {
          description: "Canonical SignalFlow Asset records. Runtime file objects, credentials, temporary URLs, and local paths are rejected or excluded by the shared contract.",
          type: "array",
          maxItems: GENERATION_LIMITS.sourceRecordsPerKind,
          items: { type: "object", additionalProperties: true },
        },
        sourceArtifacts: {
          description: "Canonical SignalFlow SourceArtifact records linked to the supplied assets.",
          type: "array",
          maxItems: GENERATION_LIMITS.sourceRecordsPerKind,
          items: { type: "object", additionalProperties: true },
        },
        processingRecords: {
          description: "Canonical AssetProcessing records for derived outputs and extraction/transformation lineage.",
          type: "array",
          maxItems: GENERATION_LIMITS.sourceRecordsPerKind,
          items: { type: "object", additionalProperties: true },
        },
      },
      additionalProperties: false,
    },
  },
];

function textContent(text) {
  return [{ type: "text", text }];
}

function requireString(value, label) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

function requireProvider(value) {
  const provider = requireString(value, "provider").toLowerCase();
  if (!PROVIDERS.includes(provider)) {
    throw new Error(`Unsupported model provider: ${provider}.`);
  }
  return provider;
}

function requireChannels(value) {
  const channels = Array.isArray(value)
    ? Array.from(new Set(value.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean)))
    : [];
  if (!channels.length) throw new Error("At least one destination channel is required.");
  const unknown = channels.filter((channel) => !CHANNELS.includes(channel));
  if (unknown.length) throw new Error(`Unsupported destination channels: ${unknown.join(", ")}.`);
  return channels;
}

function canonicalizeMcpSources(args = {}) {
  const rawAssets = Array.isArray(args.assets) ? args.assets : [];
  const rawArtifacts = Array.isArray(args.sourceArtifacts) ? args.sourceArtifacts : [];
  const rawProcessing = Array.isArray(args.processingRecords) ? args.processingRecords : [];
  const declaredWorkspaces = Array.from(new Set([
    ...rawAssets.map((item) => String(item?.workspaceId || "").trim()),
    ...rawArtifacts.map((item) => String(item?.workspaceId || "").trim()),
    ...rawProcessing.map((item) => String(item?.workspaceId || "").trim()),
  ].filter(Boolean)));
  if (declaredWorkspaces.length > 1) {
    const error = new Error("Source records from different workspaces cannot be mixed in one MCP generation request.");
    error.code = "cross_workspace_reference";
    throw error;
  }
  return rawAssets.length || rawArtifacts.length || rawProcessing.length
    ? validateSourceGraph({
      workspaceId: declaredWorkspaces[0] || "mcp-workspace",
      assets: rawAssets,
      sourceArtifacts: rawArtifacts,
      processingRecords: rawProcessing,
    })
    : { assets: [], sourceArtifacts: [], processingRecords: [] };
}

export async function executeTool(name, args = {}, options = {}) {
  if (name === "signalflow_capabilities") {
    const raw = await signalFlowRequest("/api/capabilities", options);
    const data = parseCapabilitySnapshot(raw);
    const availableProviderCount = Object.values(data.capabilities.models.providers)
      .filter((provider) => provider.available)
      .length;
    return {
      content: textContent(
        `SignalFlow deployment: ${data.deployment.profile}; session role: ${data.session.role}; ` +
          `${availableProviderCount} model route${availableProviderCount === 1 ? "" : "s"} available; ` +
          `cloud persistence ${data.capabilities.persistence.cloudDatabase.available ? "available" : "unavailable"}; ` +
          `extension delivery ${data.capabilities.extension.available ? "available" : "unavailable"}.`,
      ),
      structuredContent: data,
    };
  }

  if (name === "signalflow_provider_status") {
    const data = await signalFlowRequest("/api/provider_status", options);
    const configured = Object.values(data.providers || {})
      .filter((provider) => provider?.configured)
      .map((provider) => provider.label || provider.id);
    return {
      content: textContent(
        configured.length
          ? `Configured SignalFlow model routes: ${configured.join(", ")}.`
          : "No server model route is configured. Add provider credentials to the MCP environment or SignalFlow deployment.",
      ),
      structuredContent: data,
    };
  }

  if (name === "signalflow_test_provider") {
    const provider = requireProvider(args.provider);
    const data = await signalFlowRequest("/api/provider_test", {
      ...options,
      method: "POST",
      provider,
      providerBaseUrl: args.baseUrl,
      body: {
        provider,
        modelName: String(args.modelName || "").trim(),
        baseUrl: String(args.baseUrl || "").trim(),
      },
      timeoutMs: 70000,
    });
    return {
      content: textContent(data.ok ? `${provider} connection succeeded.` : `${provider} connection failed.`),
      structuredContent: data,
      isError: !data.ok,
    };
  }

  if (name === "signalflow_validate_campaign_input") {
    const channels = Array.isArray(args.channels)
      ? Array.from(new Set(args.channels.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean)))
      : [];
    const unknownChannels = channels.filter((channel) => !CHANNELS.includes(channel));
    const validation = validateGenerationInputs({
      project_name: String(args.projectName || ""),
      notes: String(args.notes || ""),
      audience: String(args.audience || ""),
      docs_url: String(args.links || ""),
      repo: String(args.repository || ""),
      channels,
      output_types: [],
      document_text: Array.isArray(args.documentText) ? args.documentText : [],
      assets: Array.isArray(args.assets) ? args.assets : [],
      source_artifacts: Array.isArray(args.sourceArtifacts) ? args.sourceArtifacts : [],
      processing_records: Array.isArray(args.processingRecords) ? args.processingRecords : [],
    });
    const errors = [...validation.errors];
    if (unknownChannels.length) {
      errors.push(`Unsupported destination channels: ${unknownChannels.join(", ")}.`);
    }

    let canonicalSources = { assets: [], sourceArtifacts: [], processingRecords: [] };
    let sourceIssue = null;
    try {
      canonicalSources = canonicalizeMcpSources(args);
    } catch (error) {
      sourceIssue = {
        code: String(error?.code || "invalid_source_contract"),
        message: String(error?.message || "Source contract validation failed."),
      };
      errors.push(sourceIssue.message);
    }

    const ok = errors.length === 0;
    return {
      content: textContent(ok
        ? "SignalFlow campaign input is valid and can proceed to generation."
        : `SignalFlow campaign input needs correction: ${errors[0] || "validation failed"}`),
      structuredContent: {
        ok,
        errors,
        limitIssues: validation.limitIssues,
        sourceIssue,
        sourceSummary: {
          assets: canonicalSources.assets.length,
          sourceArtifacts: canonicalSources.sourceArtifacts.length,
          processingRecords: canonicalSources.processingRecords.length,
        },
      },
      isError: !ok,
    };
  }

  if (name === "signalflow_start_campaign") {
    const projectName = requireString(args.projectName, "projectName");
    const notes = requireString(args.notes, "notes");
    const provider = requireProvider(args.provider);
    const channels = requireChannels(args.channels);
    const registry = options.executionRegistry || campaignExecutionRegistry;
    const executionKey = `project:${projectName.trim().toLowerCase()}`;
    const job = registry.start(async ({ signal, reportProgress }) => {
      reportProgress({
        phase: "generating",
        completedDestinations: 0,
        totalDestinations: channels.length,
      });
      return executeTool("signalflow_create_campaign", {
        ...args,
        projectName,
        notes,
        provider,
        channels,
      }, {
        ...options,
        signal,
      });
    }, {
      executionKey,
      metadata: {
        projectName,
        provider,
        channels,
      },
    });
    return {
      content: textContent(`SignalFlow started campaign job ${job.id} for ${projectName}.`),
      structuredContent: { ok: true, job },
      isError: false,
    };
  }

  if (name === "signalflow_campaign_status") {
    const jobId = requireString(args.jobId, "jobId");
    const registry = options.executionRegistry || campaignExecutionRegistry;
    const job = registry.get(jobId);
    if (!job) {
      return {
        content: textContent(`Unknown SignalFlow campaign job: ${jobId}.`),
        structuredContent: { ok: false, code: "campaign_job_not_found", jobId },
        isError: true,
      };
    }
    return {
      content: textContent(`SignalFlow campaign job ${job.id} is ${job.status} (${job.phase}).`),
      structuredContent: { ok: true, job },
      isError: job.status === "failed",
    };
  }

  if (name === "signalflow_cancel_campaign") {
    const jobId = requireString(args.jobId, "jobId");
    const registry = options.executionRegistry || campaignExecutionRegistry;
    const job = registry.cancel(jobId);
    if (!job) {
      return {
        content: textContent(`Unknown SignalFlow campaign job: ${jobId}.`),
        structuredContent: { ok: false, code: "campaign_job_not_found", jobId },
        isError: true,
      };
    }
    return {
      content: textContent(`SignalFlow cancellation requested for campaign job ${job.id}.`),
      structuredContent: { ok: true, job },
      isError: false,
    };
  }

  if (name === "signalflow_create_campaign") {
    const projectName = requireString(args.projectName, "projectName");
    const notes = requireString(args.notes, "notes");
    const provider = requireProvider(args.provider);
    const channels = requireChannels(args.channels);
    const canonicalSources = canonicalizeMcpSources(args);

    let data;
    try {
      data = await signalFlowRequest("/api/launch_kit", {
        ...options,
        method: "POST",
        provider,
        providerBaseUrl: args.baseUrl,
        timeoutMs: 240000,
        body: {
          project_name: projectName,
          notes,
          audience: String(args.audience || "Founders, builders, and early users").trim(),
          docs_url: String(args.links || "").trim(),
          repo: String(args.repository || "").trim(),
          channels,
          output_types: ["posts", "media_plan", "markdown", "json"],
          generator: provider,
          providerModelName: String(args.modelName || "").trim(),
          providerBaseUrl: String(args.baseUrl || "").trim(),
          document_text: Array.isArray(args.documentText) ? args.documentText : [],
          assets: canonicalSources.assets,
          source_artifacts: canonicalSources.sourceArtifacts,
          processing_records: canonicalSources.processingRecords,
          media_items: canonicalSources.sourceArtifacts.map((artifact) => projectGenerationMediaItem(artifact)),
        },
      });
    } catch (error) {
      if (error?.signalFlowData && typeof error.signalFlowData === "object") {
        const structured = error.signalFlowData;
        const message = structured.providerError?.message
          || (structured.code === "strategy_quality_blocked"
            ? "SignalFlow blocked destination generation because the strategy needs review."
            : structured.error)
          || "SignalFlow could not create this campaign.";
        return {
          content: textContent(message),
          structuredContent: structured,
          isError: true,
        };
      }
      throw error;
    }

    const generated = Object.entries(data.generation_status || {})
      .filter(([, status]) => ["generated", "regenerated", "needs_review"].includes(status?.status))
      .map(([channel]) => channel);
    const failed = Object.entries(data.generation_status || {})
      .filter(([, status]) => status?.status === "failed")
      .map(([channel]) => channel);

    return {
      content: textContent(
        `SignalFlow created ${generated.length} destination draft${generated.length === 1 ? "" : "s"} for ${projectName}` +
          `${failed.length ? `; ${failed.length} destination${failed.length === 1 ? "" : "s"} failed and contain no template substitute` : ""}.`,
      ),
      structuredContent: data,
      isError: generated.length === 0,
    };
  }

  throw new Error(`Unknown SignalFlow MCP tool: ${name}.`);
}
