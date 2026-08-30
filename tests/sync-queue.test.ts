import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

Object.defineProperty(globalThis.navigator, "onLine", { value: true, configurable: true });

const insert = vi.fn(async (payload: Record<string, unknown>) => ({
  error: payload.title === "fails" ? new Error("simulated failure") : null,
}));

vi.mock("../src/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ insert }),
  },
}));

import { enqueueOp, flushQueue, getQueue } from "../src/lib/sync-queue";

describe("offline sync queue", () => {
  beforeEach(async () => {
    insert.mockClear();
    const queued = await getQueue();
    // Flush leftovers from a previous assertion by making every insert succeed.
    if (queued.length > 0) {
      insert.mockImplementation(async () => ({ error: null }));
      await flushQueue();
      insert.mockImplementation(async (payload: Record<string, unknown>) => ({
        error: payload.title === "fails" ? new Error("simulated failure") : null,
      }));
    }
  });

  it("keeps a failed operation for retry without blocking later operations", async () => {
    await enqueueOp({ table: "tasks", action: "insert", payload: { title: "fails" } });
    await enqueueOp({ table: "tasks", action: "insert", payload: { title: "succeeds" } });

    const result = await flushQueue();
    expect(result).toEqual({ applied: 1, failed: 1 });

    const remaining = await getQueue();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toMatchObject({ attempts: 1, lastError: "simulated failure" });
  });

  it("rejects tables outside the explicit offline allowlist", async () => {
    await expect(
      enqueueOp({ table: "profiles", action: "update", payload: { full_name: "Unsafe" } }),
    ).rejects.toThrow(/ne prend pas en charge/);
  });
});
