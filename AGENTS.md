# Dashboard Agent MCP Guidance

## Purpose

This repository exposes the existing Dashboard Graph Agent as an MCP Apps server. Keep analytics in the upstream Dashboard Agent and keep presentation inside the MCP App resource.

## Rules

- Do not copy database credentials, cloud credentials, or private data into this repository.
- Keep `DashboardDocument` generic and versioned. Never encode prompt-specific dashboards in the renderer.
- The model-facing MCP surface should remain small. Prefer one high-level dashboard tool over many schema-specific tools.
- MCP App rendering is progressive enhancement. Preserve useful text and structured-data responses for non-UI clients.
- Keep the UI resource self-contained and do not load scripts from public CDNs.
- Run `npm test` and `npm run build` after behavior changes.
- Browser-check the standalone fixture view at desktop and mobile widths after chart or layout changes.

## Integration boundary

- Upstream backend: configured by `DASHBOARD_AGENT_URL`.
- MCP transport: Streamable HTTP at `/mcp`, plus optional stdio.
- UI resource: `ui://dashboard-agent/dashboard-app.html`.
- Canonical result: `DashboardDocument` from `src/shared/dashboard-contract.ts`.

