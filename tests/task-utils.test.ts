import { describe, expect, it } from "vitest";
import { isOverdue } from "@/lib/task-utils";

const now = new Date(2026, 7, 23, 16, 0, 0);

function task(due_date: string | null, due_time: string | null, status = "todo") {
  return { due_date, due_time, status } as Parameters<typeof isOverdue>[0];
}

describe("isOverdue", () => {
  it("marks a timed task overdue as soon as its time passes today", () => {
    expect(isOverdue(task("2026-08-23", "14:00:00"), now)).toBe(true);
  });

  it("keeps a later timed task today as not overdue", () => {
    expect(isOverdue(task("2026-08-23", "18:00:00"), now)).toBe(false);
  });

  it("keeps an untimed task due today active for the whole day", () => {
    expect(isOverdue(task("2026-08-23", null), now)).toBe(false);
  });

  it("marks an unfinished task from a previous day overdue", () => {
    expect(isOverdue(task("2026-08-22", null), now)).toBe(true);
  });

  it("does not mark completed, cancelled, or postponed tasks overdue", () => {
    expect(isOverdue(task("2026-08-22", "10:00:00", "done"), now)).toBe(false);
    expect(isOverdue(task("2026-08-22", "10:00:00", "cancelled"), now)).toBe(false);
    expect(isOverdue(task("2026-08-22", "10:00:00", "postponed"), now)).toBe(false);
  });
});
