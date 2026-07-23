import { describe, expect, it } from "vitest";

import { assistantTextFromLangGraph, parseGraphDashboardMarker } from "../src/server/marker-parser";

describe("dashboard marker parser", () => {
  it("extracts the latest graph dashboard payload", () => {
    const text = [
      "Older result",
      '<<<GRAPH_DASHBOARD_WIDGET>>>{"title":"Old"}<<<END_GRAPH_DASHBOARD_WIDGET>>>' ,
      '<<<GRAPH_DASHBOARD_WIDGET>>>{"title":"Current","activity":{"chartSlots":[]}}<<<END_GRAPH_DASHBOARD_WIDGET>>>',
    ].join("\n");
    expect(parseGraphDashboardMarker(text)).toMatchObject({ title: "Current" });
  });

  it("reads the latest assistant message from LangGraph state", () => {
    const response = {
      values: {
        messages: [
          { type: "human", content: "question" },
          { type: "ai", content: [{ type: "text", text: "dashboard result" }] },
        ],
      },
    };
    expect(assistantTextFromLangGraph(response)).toBe("dashboard result");
  });
});
