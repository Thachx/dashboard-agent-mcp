# Dashboard Agent MCP

An MCP Apps server for the Dashboard Graph Agent. Other agents call one MCP tool and receive both:

- a concise text result for the model; and
- a portable interactive dashboard rendered from a `ui://` MCP App resource.

The consuming agent does not need the dashboard renderer. A compatible MCP host loads the renderer from this server and displays it in a sandboxed iframe.

## Architecture

```text
MCP host -> create_dashboard -> Dashboard Agent LangGraph API
         <- structuredContent + ui://dashboard-agent/dashboard-app.html
         -> embedded React/Recharts dashboard
```

The MCP server does not query Graph or DuckDB directly. Planning, joins, graph traversal, DuckDB fallback, localization, and source lineage remain owned by the existing Dashboard Agent backend.

The browser UI is packaged into one HTML resource at build time. MCP Apps-compatible hosts retrieve that resource from this server, so callers do not install React, Recharts, or any dashboard components.

## Requirements

- Node.js 20 or newer
- A running Dashboard Agent LangGraph server, unless fixture mode is enabled

## Setup

```powershell
npm install
Copy-Item .env.example .env
npm run build
npm start
```

The MCP endpoint is `http://127.0.0.1:3001/mcp` and the health endpoint is `http://127.0.0.1:3001/health`.

When the MCP client runs in Docker Desktop, add `host.docker.internal` to
`MCP_ALLOWED_HOSTS` and connect the client to the host-published port.

For a local server without the Dashboard Agent backend:

```powershell
$env:DASHBOARD_AGENT_FIXTURE = "true"
npm start
```

## Development

```powershell
npm run dev
```

This runs the MCP server and the standalone dashboard view. The UI dev server uses fixture data so chart layout can be reviewed without an MCP host.

Open the standalone preview at `http://127.0.0.1:5173/dashboard-app.html`.

## Codex project

This repository includes `AGENTS.md` and `.codex/config.toml` and can be opened directly as a Codex project at `D:\git\dashboard-agent-mcp`. The local Codex configuration also registers that path as trusted.

## MCP client configuration

### Streamable HTTP

Point a compatible MCP client at:

```text
http://127.0.0.1:3001/mcp
```

### stdio

```json
{
  "mcpServers": {
    "dashboard-agent": {
      "command": "node",
      "args": ["D:/git/dashboard-agent-mcp/dist/server/server/main.js", "--stdio"],
      "env": {
        "DASHBOARD_AGENT_URL": "http://127.0.0.1:2024",
        "DASHBOARD_AGENT_ASSISTANT_ID": "dashboard_agent"
      }
    }
  }
}
```

## Tool

### `create_dashboard`

Input:

```json
{
  "question": "Show users by institute split by learning status",
  "locale": "en",
  "timezone": "Asia/Bangkok",
  "maxCharts": 6
}
```

The tool is read-only and has no external side effects. It returns a `DashboardDocument` in `structuredContent`. The MCP App receives the same document and renders the charts.

## Compatibility

Interactive rendering requires an MCP Apps-compatible host. A host that only implements core MCP still receives the text summary and structured dashboard data, but it cannot display the embedded iframe without MCP Apps support.

## Commands

```text
npm run dev          Run MCP server and UI dev server
npm run dev:server   Run only the MCP server in watch mode
npm run dev:ui       Run only the standalone UI
npm run build        Type-check and build server + single-file MCP App
npm test             Run unit tests
npm start            Start the production MCP server
```
