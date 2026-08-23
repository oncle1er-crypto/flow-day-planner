import { describe, expect, it } from "vitest";
import {
  DAILY_REMINDER_ID,
  MAX_NATIVE_TASK_REMINDERS,
  buildReminderPlan,
  notificationIdForTask,
  taskReminderDate,
  type ReminderSettings,
  type ReminderTask,
} from "@/lib/reminder-plan";

const settings: ReminderSettings = {
  notifications_enabled: true,
  sound_enabled: true,
  default_reminder_minutes: 15,
  daily_reminder_enabled: false,
  daily_reminder_time: null,
};

function task(overrides: Partial<ReminderTask> = {}): ReminderTask {
  return {
    id: "task-1",
    title: "Test",
    due_date: "2030-01-01",
    due_time: "10:00:00",
    reminder_enabled: true,
    status: "todo",
    is_archived: false,
    ...overrides,
  };
}

describe("reminder planning", () => {
  it("generates a stable positive 32-bit notification id", () => {
    const a = notificationIdForTask("abc-123");
    const b = notificationIdForTask("abc-123");
    expect(a).toBe(b);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThanOrEqual(2_147_483_647);
  });

  it("subtracts the configured lead time", () => {
    const fireAt = taskReminderDate(task(), 15);
    expect(fireAt?.getHours()).toBe(9);
    expect(fireAt?.getMinutes()).toBe(45);
  });

  it("does not plan reminders when notifications are disabled", () => {
    const plan = buildReminderPlan([task()], { ...settings, notifications_enabled: false });
    expect(plan).toEqual([]);
  });

  it("ignores done, cancelled, archived and disabled reminders", () => {
    const plan = buildReminderPlan(
      [
        task({ id: "done", status: "done" }),
        task({ id: "cancelled", status: "cancelled" }),
        task({ id: "archived", is_archived: true }),
        task({ id: "disabled", reminder_enabled: false }),
      ],
      settings,
      new Date("2029-01-01T00:00:00"),
    );
    expect(plan).toEqual([]);
  });

  it("plans task and daily reminders with sound", () => {
    const plan = buildReminderPlan(
      [task()],
      { ...settings, daily_reminder_enabled: true, daily_reminder_time: "08:30:00" },
      new Date("2029-01-01T00:00:00"),
    );
    const taskPlan = plan.find((item) => item.kind === "task");
    const daily = plan.find((item) => item.kind === "daily");
    expect(taskPlan?.sound).toBe(true);
    expect(daily).toMatchObject({ id: DAILY_REMINDER_ID, hour: 8, minute: 30, sound: true });
  });

  it("propagates silent preference", () => {
    const plan = buildReminderPlan(
      [task()],
      { ...settings, sound_enabled: false },
      new Date("2029-01-01T00:00:00"),
    );
    expect(plan[0]?.sound).toBe(false);
  });

  it("keeps only the earliest native task reminders to stay under iOS limits", () => {
    const tasks = Array.from({ length: MAX_NATIVE_TASK_REMINDERS + 10 }, (_, index) =>
      task({
        id: `task-${index}`,
        due_date: "2030-01-01",
        due_time: `${String(Math.floor(index / 60)).padStart(2, "0")}:${String(index % 60).padStart(2, "0")}:00`,
      }),
    );
    const plan = buildReminderPlan(tasks, settings, new Date("2029-01-01T00:00:00"));
    expect(plan.filter((item) => item.kind === "task")).toHaveLength(MAX_NATIVE_TASK_REMINDERS);
  });
});
