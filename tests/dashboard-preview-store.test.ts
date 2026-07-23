import { afterEach, describe, expect, it, vi } from "vitest";

import { createDashboardPreviewStore } from "../src/server/dashboard-preview-store.js";

describe("dashboard preview store", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores previews with bounded capacity and expiration", () => {
    vi.useFakeTimers();
    const store = createDashboardPreviewStore({ ttlMs: 1_000, maxEntries: 1 });
    const firstId = store.put(Buffer.from("first"));
    const secondId = store.put(Buffer.from("second"));

    expect(store.get(firstId)).toBeUndefined();
    expect(store.get(secondId)?.toString()).toBe("second");

    vi.advanceTimersByTime(1_001);
    expect(store.get(secondId)).toBeUndefined();
  });
});
