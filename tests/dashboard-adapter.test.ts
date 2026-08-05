import { afterEach, describe, expect, it, vi } from "vitest";

import { createDashboard } from "../src/server/dashboard-adapter";

describe("dashboard adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.DASHBOARD_AGENT_FIXTURE;
    delete process.env.DASHBOARD_AGENT_URL;
  });

  it("returns a chart-free document when the upstream answer has no dashboard marker", async () => {
    const responses = [
      new Response(JSON.stringify({ thread_id: "thread-1" }), { status: 200 }),
      new Response(JSON.stringify({
        values: {
          messages: [
            { type: "human", content: "How many active users are there?" },
            { type: "ai", content: "There are 42 active users." },
          ],
        },
      }), { status: 200 }),
    ];
    const fetchMock = vi.fn(async () => responses.shift() ?? new Response("unexpected request", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createDashboard({ question: "How many active users are there?" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      title: "Analysis result",
      summary: "There are 42 active users.",
      charts: [],
      metrics: [],
      execution: { source: "unknown" },
    });
  });
});
