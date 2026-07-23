import "dotenv/config";

import { createServer } from "node:http";

import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Request, Response } from "express";

import { createDashboardMcpServer } from "./server.js";

async function runStdio(): Promise<void> {
  const server = createDashboardMcpServer();
  await server.connect(new StdioServerTransport());
}

async function runHttp(): Promise<void> {
  const host = process.env.MCP_HOST ?? "127.0.0.1";
  const port = Number(process.env.MCP_PORT ?? 3001);
  const allowedHosts = process.env.MCP_ALLOWED_HOSTS
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const app = createMcpExpressApp({
    host,
    ...(allowedHosts?.length ? { allowedHosts } : {}),
  });

  app.get("/health", (_request: Request, response: Response) => {
    response.json({ ok: true, service: "dashboard-agent-mcp" });
  });

  app.all("/mcp", async (request: Request, response: Response) => {
    const server = createDashboardMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    response.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(request, response, request.body);
  });

  createServer(app).listen(port, host, () => {
    process.stderr.write(`Dashboard Agent MCP listening on http://${host}:${port}/mcp\n`);
  });
}

if (process.argv.includes("--stdio")) {
  await runStdio();
} else {
  await runHttp();
}
