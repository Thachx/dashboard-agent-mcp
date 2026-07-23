import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createDashboardMcpServer, DASHBOARD_RESOURCE_URI } from "../src/server/server";

describe("MCP server", () => {
  afterEach(() => { delete process.env.DASHBOARD_AGENT_FIXTURE; });

  it("advertises the app and returns a portable dashboard document", async () => {
    process.env.DASHBOARD_AGENT_FIXTURE = "true";
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createDashboardMcpServer({ resourceHtml: "<!doctype html><div id=\"root\"></div>" });
    const client = new Client({ name: "dashboard-agent-test", version: "1.0.0" });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const tools = await client.listTools();
    const resources = await client.listResources();
    const appResource = await client.readResource({ uri: DASHBOARD_RESOURCE_URI });
    const result = await client.callTool({
      name: "create_dashboard",
      arguments: { question: "Tell me about users", maxCharts: 2 },
    });

    expect(tools.tools.map((tool) => tool.name)).toContain("create_dashboard");
    expect(resources.resources.map((resource) => resource.uri)).toContain(DASHBOARD_RESOURCE_URI);
    expect(tools.tools.find((tool) => tool.name === "create_dashboard")?._meta).toMatchObject({
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

    await client.close();
    await server.close();
  });
});
