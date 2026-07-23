import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { createDashboard } from "./dashboard-adapter.js";
import { renderDashboardPreview } from "./dashboard-image.js";

export const DASHBOARD_RESOURCE_URI = "ui://dashboard-agent/dashboard-app.html";
export const DASHBOARD_TOOL_NAME = "create_dashboard";
export const DASHBOARD_PROMPT_NAME = "dashboard";

const resourcePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../ui/dashboard-app.html",
);

export function createDashboardMcpServer(options: { resourceHtml?: string } = {}): McpServer {
  const server = new McpServer({
    name: "dashboard-agent-mcp",
    version: "0.1.0",
  });

  registerAppTool(
    server,
    DASHBOARD_TOOL_NAME,
    {
      title: "Create analytical dashboard",
      description:
        "Plan and generate a source-backed analytical dashboard for a natural-language question. " +
        "Use this when the user asks for metrics, comparisons, distributions, trends, or joined analysis.",
      inputSchema: {
        question: z.string().min(2).describe("The user's analytical question."),
        locale: z.string().optional().describe("BCP 47 response locale, such as en or th."),
        timezone: z.string().optional().describe("IANA timezone, such as Asia/Bangkok."),
        maxCharts: z.number().int().min(1).max(8).optional(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      _meta: {
        ui: { resourceUri: DASHBOARD_RESOURCE_URI },
      },
    },
    async (request) => {
      try {
        const dashboard = await createDashboard(request);
        const preview = await renderDashboardPreview(dashboard);
        return {
          content: [
            { type: "text", text: dashboard.summary },
            ...(preview
              ? [{
                  type: "image" as const,
                  data: preview.toString("base64"),
                  mimeType: "image/png",
                }]
              : []),
          ],
          structuredContent: dashboard,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown dashboard error";
        return {
          isError: true,
          content: [{ type: "text", text: `Could not create the dashboard: ${message}` }],
        };
      }
    },
  );

  server.registerPrompt(
    DASHBOARD_PROMPT_NAME,
    {
      title: "Create dashboard",
      description:
        "Require the Dashboard Agent to create an analytical dashboard for a natural-language question.",
      argsSchema: {
        question: z.string().min(2).describe("The analytical question for the dashboard."),
      },
    },
    async ({ question }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `You must call the ${DASHBOARD_TOOL_NAME} tool from the Dashboard Agent MCP server now. ` +
              "Do not answer from memory or perform a substitute analysis. " +
              `Pass this question to the tool exactly as written: ${JSON.stringify(question)}. ` +
              "Return the tool's summary and interactive dashboard. " +
              "If the tool is unavailable, say that it must be enabled instead of fabricating a dashboard.",
          },
        },
      ],
    }),
  );

  registerAppResource(
    server,
    "Dashboard Agent view",
    DASHBOARD_RESOURCE_URI,
    {
      description: "Interactive renderer for Dashboard Agent results.",
      mimeType: RESOURCE_MIME_TYPE,
    },
    async () => ({
      contents: [
        {
          uri: DASHBOARD_RESOURCE_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: options.resourceHtml ?? await readFile(resourcePath, "utf8"),
          _meta: {
            ui: {
              csp: { resourceDomains: [], connectDomains: [] },
            },
          },
        },
      ],
    }),
  );

  return server;
}
