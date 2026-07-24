# GitHub MCP Read-Only Access

The repository is public, and a GitHub-connected coding client can use it as a read-only source of truth. Repository files cannot silently authorize an external client; the client must connect its own GitHub MCP integration.

## Minimum Permissions

For a fine-grained GitHub token or GitHub App connection, limit access to this repository and prefer:

- Repository metadata: read-only
- Contents: read-only
- Pull requests: read-only, optional
- Issues: read-only, optional
- Actions: read-only only when build logs are needed

Do not grant Administration, Secrets, Environments, Deployments write, Actions write, or Contents write for a reading agent.

Never put a token in this repository, an agent prompt, `.env.example`, screenshots, or documentation.

## Reading Order for an Agent

1. `AGENTS.md`
2. `README.md`
3. `docs/APP_WORKSPACE_SYSTEM.md`
4. `docs/STUDIO_UX_SYSTEM.md`
5. `docs/CONNECTOR_READINESS.md`
6. `frontend/app/page.js`
7. `frontend/app/app-workspace.css`
8. `frontend/app/api/launch_kit/route.js`
9. `frontend/app/api/social/` and `frontend/lib/social/`
10. `SECURITY.md`

## Suggested Agent Instruction

```text
Use GitHub MCP in read-only mode for Ankit6149/SignalFlow-Studio. Read AGENTS.md and the linked product documents first. Treat master as the source of truth. Do not modify files, create branches, open pull requests, change settings, or access secrets. Report architecture, current capabilities, limitations, and relevant file paths with evidence.
```

## What Read-Only MCP Solves

- Accurate repository navigation
- Current architecture and implementation context
- File-backed product truth
- Reduced dependence on very long prompts
- Easier handoff between Codex, Claude, Gemini/Antigravity, or another coding client

It does not provide deployment credentials, social developer applications, OAuth approval, or permission to publish.
