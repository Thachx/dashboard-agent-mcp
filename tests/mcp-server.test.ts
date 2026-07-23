import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import {
  createDashboardMcpServer,
  DASHBOARD_PROMPT_NAME,
  DASHBOARD_RESOURCE_URI,
  DASHBOARD_TOOL_NAME,
} from "../src/server/server";

describe("MCP server", () => {
  afterEach(() => { delete process.env.DASHBOARD_AGENT_FIXTURE; });

  it("advertises the app and returns a portable dashboard document", async () => {
    process.env.DASHBOARD_AGENT_FIXTURE = "true";
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createDashboardMcpServer({
      resourceHtml: "<!doctype html><div id=\"root\"></div>",
      publishPreview: () => "http://127.0.0.1:3001/dashboard-previews/test.png",
    });
    const client = new Client({ name: "dashboard-agent-test", version: "1.0.0" });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const tools = await client.listTools();
    const prompts = await client.listPrompts();
    const dashboardPrompt = await client.getPrompt({
      name: DASHBOARD_PROMPT_NAME,
      arguments: { question: "Show active users by institute" },
    });
    const resources = await client.listResources();
    const appResource = await client.readResource({ uri: DASHBOARD_RESOURCE_URI });
    const result = await client.callTool({
      name: "create_dashboard",
      arguments: { question: "Tell me about users", maxCharts: 2 },
    });

    expect(tools.tools.map((tool) => tool.name)).toContain(DASHBOARD_TOOL_NAME);
    expect(prompts.prompts.map((prompt) => prompt.name)).toContain(DASHBOARD_PROMPT_NAME);
    expect(dashboardPrompt.messages[0]?.content).toEqual({
      type: "text",
      text: "/dashboard Show active users by institute",
    });
    expect(resources.resources.map((resource) => resource.uri)).toContain(DASHBOARD_RESOURCE_URI);
    expect(tools.tools.find((tool) => tool.name === DASHBOARD_TOOL_NAME)?._meta).toMatchObject({
      ui: { resourceUri: DASHBOARD_RESOURCE_URI },
    });
    expect(appResource.contents[0]).toMatchObject({
      uri: DASHBOARD_RESOURCE_URI,
      text: "<!doctype html><div id=\"root\"></div>",
    });
    expect(result.structuredContent).toMatchObject({
      schemaVersion: "1.0",
      query: "Tell me about users",
      execution: { source: "fixture" },
    });
    const content = result.content as Array<{ type: string; data?: string; mimeType?: string }>;
    expect(content.find((item) => item.type === "text")).toMatchObject({
      text:
        "### Users by Learning Status\n" +
        "103.3K users are represented across three learning statuses and six departments.\n\n" +
        "![Users by Learning Status](http://127.0.0.1:3001/dashboard-previews/test.png)",
    });
    const preview = content.find((item) => item.type === "image");
    expect(preview).toMatchObject({ type: "image", mimeType: "image/png" });
    if (preview?.data) {
      expect(Buffer.from(preview.data, "base64").subarray(0, 8)).toEqual(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      );
    }

    await client.close();
    await server.close();
  });
});
