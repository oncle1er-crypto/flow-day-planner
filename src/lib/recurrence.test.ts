import { describe, it, expect } from "vitest";
import {
  nextDueDate,
  buildNextOccurrence,
  weekdayOf,
  type RecurringTaskSource,
} from "./recurrence";

describe("nextDueDate", () => {
  it("returns null when there is no recurrence", () => {
    expect(nextDueDate("2026-01-05", "none")).toBeNull();
    expect(nextDueDate("", "daily")).toBeNull();
  });

  it("handles daily and custom intervals", () => {
    expect(nextDueDate("2026-01-05", "daily")).toBe("2026-01-06");
    expect(nextDueDate("2026-01-05", "daily", { interval: 3 })).toBe("2026-01-08");
  });

  it("handles weekly and yearly", () => {
    expect(nextDueDate("2026-01-05", "weekly")).toBe("2026-01-12");
    expect(nextDueDate("2026-02-28", "yearly")).toBe("2027-02-28");
  });

  it("clamps month-end overflow", () => {
    expect(nextDueDate("2026-01-31", "monthly")).toBe("2026-02-28");
    expect(nextDueDate("2026-03-31", "monthly")).toBe("2026-04-30");
  });

  it("crosses year boundaries without drift", () => {
    expect(nextDueDate("2026-12-31", "daily")).toBe("2027-01-01");
  });

  it("skips weekends for weekdays", () => {
    // 2026-01-02 is a Friday
    expect(weekdayOf("2026-01-02")).toBe(5);
    expect(nextDueDate("2026-01-02", "weekdays")).toBe("2026-01-05");
    expect(nextDueDate("2026-01-05", "weekdays")).toBe("2026-01-06");
  });

  it("picks the next selected weekday for custom", () => {
    // Monday(1) and Thursday(4); 2026-01-05 is a Monday
    expect(nextDueDate("2026-01-05", "custom", { days_of_week: [1, 4] })).toBe("2026-01-08");
    expect(nextDueDate("2026-01-08", "custom", { days_of_week: [1, 4] })).toBe("2026-01-12");
  });

  it("returns null for custom without days", () => {
    expect(nextDueDate("2026-01-05", "custom", { days_of_week: [] })).toBeNull();
  });
});

const base: RecurringTaskSource = {
  id: "task-1",
  user_id: "user-1",
  title: "Sport",
  description: null,
  due_date: "2026-01-05",
  due_time: "07:30:00",
  priority: "normal",
  category_id: null,
  tags: [],
  color: null,
  icon: null,
  notes: null,
  reminder_enabled: false,
  recurrence: "daily",
  recurrence_config: {},
  recurrence_end_date: null,
  recurrence_parent_id: null,
  occurrence_index: 0,
};

describe("buildNextOccurrence", () => {
  it("returns null for non-recurring or dateless tasks", () => {
    expect(buildNextOccurrence({ ...base, recurrence: "none" })).toBeNull();
    expect(buildNextOccurrence({ ...base, due_date: null })).toBeNull();
  });

  it("builds the next occurrence with a stable series root", () => {
    const row = buildNextOccurrence(base)!;
    expect(row.due_date).toBe("2026-01-06");
    expect(row.status).toBe("todo");
    expect(row.recurrence_parent_id).toBe("task-1");
    expect(row.occurrence_index).toBe(1);
  });

  it("keeps the original root for later occurrences", () => {
    const row = buildNextOccurrence({
      ...base,
      id: "task-2",
      recurrence_parent_id: "task-1",
      occurrence_index: 1,
      due_date: "2026-01-06",
    })!;
    expect(row.recurrence_parent_id).toBe("task-1");
    expect(row.occurrence_index).toBe(2);
  });

  it("stops after the end date", () => {
    expect(buildNextOccurrence({ ...base, recurrence_end_date: "2026-01-05" })).toBeNull();
    expect(buildNextOccurrence({ ...base, recurrence_end_date: "2026-01-06" })).not.toBeNull();
  });

  it("stops after max_occurrences", () => {
    expect(
      buildNextOccurrence({
        ...base,
        occurrence_index: 2,
        recurrence_config: { max_occurrences: 3 },
      }),
    ).toBeNull();
    expect(
      buildNextOccurrence({
        ...base,
        occurrence_index: 1,
        recurrence_config: { max_occurrences: 3 },
      }),
    ).not.toBeNull();
  });
});
