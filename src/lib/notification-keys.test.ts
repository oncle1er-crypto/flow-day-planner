import { describe, it, expect } from "vitest";
import { reminderDedupeKey } from "./notification-keys";

describe("reminderDedupeKey", () => {
  it("collapses retries inside the same minute to one key", () => {
    const a = reminderDedupeKey("task", "t1", "2026-01-05T08:30:12.000Z");
    const b = reminderDedupeKey("task", "t1", "2026-01-05T08:30:59.500Z");
    expect(a).toBe(b);
  });

  it("differs across minutes, refs and kinds", () => {
    const key = reminderDedupeKey("task", "t1", "2026-01-05T08:30:00.000Z");
    expect(key).not.toBe(reminderDedupeKey("task", "t1", "2026-01-05T08:31:00.000Z"));
    expect(key).not.toBe(reminderDedupeKey("task", "t2", "2026-01-05T08:30:00.000Z"));
    expect(key).not.toBe(reminderDedupeKey("daily", "t1", "2026-01-05T08:30:00.000Z"));
  });

  it("is a stable readable shape", () => {
    expect(reminderDedupeKey("daily", "user-1", "2026-01-05T09:00:00.000Z")).toBe(
      "daily:user-1:2026-01-05T09:00",
    );
  });
});
