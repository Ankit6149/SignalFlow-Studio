# SignalFlow MCP server

This stdio MCP server lets compatible AI clients create SignalFlow campaigns through the same `/api/launch_kit` product API used by Studio.

## Start

```bash
cd mcp
npm start
```

The server uses standard input/output for MCP JSON-RPC. Logs are written only to standard error.

## Environment

```bash
SIGNALFLOW_BASE_URL=https://signal-flow-studio.vercel.app
SIGNALFLOW_ACCESS_KEY=optional-owner-workspace-key

# Configure only the providers you use:
SIGNALFLOW_GEMINI_API_KEY=...
SIGNALFLOW_OPENAI_API_KEY=...
SIGNALFLOW_ANTHROPIC_API_KEY=...
SIGNALFLOW_OPENROUTER_API_KEY=...
SIGNALFLOW_GROQ_API_KEY=...
SIGNALFLOW_CUSTOM_API_KEY=...
SIGNALFLOW_CUSTOM_BASE_URL=https://provider.example/v1
```

Provider secrets stay in the MCP process environment and are not part of tool arguments or model-visible prompts.

## Client configuration example

```json
{
  "mcpServers": {
    "signalflow": {
      "command": "node",
      "args": ["/absolute/path/to/SignalFlow-Studio/mcp/server.mjs"],
      "env": {
        "SIGNALFLOW_BASE_URL": "http://localhost:3000",
        "SIGNALFLOW_GEMINI_API_KEY": "your-key"
      }
    }
  }
}
```

## Tools

- `signalflow_capabilities` — inspect deployment/session capability truth.
- `signalflow_provider_status` — inspect configured model routes.
- `signalflow_test_provider` — verify one configured model route.
- `signalflow_validate_campaign_input` — validate shared generation limits and source relationships without model spend.
- `signalflow_build_strategy` — build or refresh the canonical hosted NarrativeStrategy for an existing opportunity through the owner-authorized planning service.
- `signalflow_start_campaign` — start trackable campaign generation and return a job ID.
- `signalflow_campaign_status` — inspect trackable campaign work.
- `signalflow_cancel_campaign` — request cancellation of queued or active campaign work.
- `signalflow_create_campaign` — blocking compatibility path for campaign generation.

Campaign creation requires a real model provider. Validation does not call a model. The MCP server does not expose or request the retired local template route.
