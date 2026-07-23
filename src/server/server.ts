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

export function createDashboardMcpServer(options: {
  resourceHtml?: string;
  publishPreview?: (preview: Buffer) => string | Promise<string>;
} = {}): McpServer {
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
        "Use this when the user asks for metrics, comparisons, distributions, trends, or joined analysis. " +
        "Always use this tool when the user's message starts with /dashboard, passing the text after the command " +
        "as the question. After a successful call, return the tool's text content exactly as the final response " +
        "without a preface, postscript, implementation details, or substitute analysis.",
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
        const previewUrl = preview && options.publishPreview
          ? await options.publishPreview(preview)
          : undefined;
        const markdownAlt = dashboard.title.replaceAll(/[[\]\r\n]/g, "");
        const responseText = previewUrl
          ? [
              `### ${dashboard.title}`,
              dashboard.summary,
              "",
              `![${markdownAlt}](${previewUrl})`,
            ].join("\n")
          : dashboard.summary;
        return {
          content: [
            { type: "text", text: responseText },
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
        "Create an analytical dashboard from a short natural-language question.",
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
            text: `/${DASHBOARD_PROMPT_NAME} ${question}`,
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
