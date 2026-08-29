import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createDashboardPreviewStore } from "../src/server/dashboard-preview-store.js";

describe("dashboard preview store", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("persists previews to disk and reads them back", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "previews-"));
    const store = createDashboardPreviewStore({ directory, ttlMs: 60_000 });
    const id = await store.put(Buffer.from("chart-bytes"));

    expect(id).toMatch(/^[a-f0-9-]{36}$/);
    await expect(readFile(path.join(directory, `${id}.png`))).resolves.toEqual(Buffer.from("chart-bytes"));
    await expect(store.get(id)).resolves.toEqual(Buffer.from("chart-bytes"));
    await expect(store.get(`${"a".repeat(36)}-extra`)).resolves.toBeUndefined();
    await expect(store.get("../../etc/passwd")).resolves.toBeUndefined();
  });

  it("expires previews past the ttl", async () => {
    vi.useFakeTimers({ now: Date.now() });
    const directory = await mkdtemp(path.join(tmpdir(), "previews-"));
    const store = createDashboardPreviewStore({ directory, ttlMs: 1_000 });
    const id = await store.put(Buffer.from("soon-gone"));

    vi.advanceTimersByTime(1_500);
    await expect(store.get(id)).resolves.toBeUndefined();

    const files = await readdir(directory);
    expect(files).toHaveLength(0);
  });

  it("survives a store restart from the same directory", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "previews-"));
    const first = createDashboardPreviewStore({ directory, ttlMs: 60_000 });
    const id = await first.put(Buffer.from("persisted"));

    const second = createDashboardPreviewStore({ directory, ttlMs: 60_000 });
    await expect(second.get(id)).resolves.toEqual(Buffer.from("persisted"));
  });
});
