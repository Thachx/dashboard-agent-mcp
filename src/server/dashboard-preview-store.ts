import { randomUUID } from "node:crypto";

interface StoredPreview {
  image: Buffer;
  expiresAt: number;
}

export interface DashboardPreviewStore {
  put(image: Buffer): string;
  get(id: string): Buffer | undefined;
}

export function createDashboardPreviewStore(options: {
  ttlMs: number;
  maxEntries: number;
}): DashboardPreviewStore {
  const previews = new Map<string, StoredPreview>();

  function removeExpired(now: number): void {
    for (const [id, preview] of previews) {
      if (preview.expiresAt <= now) previews.delete(id);
    }
  }

  return {
    put(image) {
      const now = Date.now();
      removeExpired(now);
      while (previews.size >= options.maxEntries) {
        const oldestId = previews.keys().next().value as string | undefined;
        if (!oldestId) break;
        previews.delete(oldestId);
      }

      const id = randomUUID();
      previews.set(id, {
        image,
        expiresAt: now + options.ttlMs,
      });
      return id;
    },
    get(id) {
      const now = Date.now();
      removeExpired(now);
      return previews.get(id)?.image;
    },
  };
}
