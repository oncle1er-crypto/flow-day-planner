export type ReminderTask = {
  id: string;
  title: string;
  due_date: string | null;
  due_time: string | null;
  reminder_enabled: boolean | null;
  status: string | null;
  is_archived?: boolean | null;
};

export type ReminderSettings = {
  notifications_enabled: boolean | null;
  sound_enabled: boolean | null;
  default_reminder_minutes: number | null;
  daily_reminder_enabled: boolean | null;
  daily_reminder_time: string | null;
};

export type PlannedReminder =
  | {
      kind: "task";
      id: number;
      taskId: string;
      title: string;
      body: string;
      at: Date;
      sound: boolean;
    }
  | {
      kind: "daily";
      id: number;
      title: string;
      body: string;
      hour: number;
      minute: number;
      sound: boolean;
    };

export const DAILY_REMINDER_ID = 900_001;
const TASK_ID_BASE = 1_000_000;
const TASK_ID_RANGE = 1_000_000_000;
export const MAX_NATIVE_TASK_REMINDERS = 50;

export function notificationIdForTask(taskId: string): number {
  let hash = 2166136261;
  for (let i = 0; i < taskId.length; i += 1) {
    hash ^= taskId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return TASK_ID_BASE + ((hash >>> 0) % TASK_ID_RANGE);
}

export function taskReminderDate(
  task: Pick<ReminderTask, "due_date" | "due_time">,
  leadMinutes: number,
): Date | null {
  if (!task.due_date) return null;
  const time = String(task.due_time ?? "09:00:00").slice(0, 8);
  const due = new Date(`${task.due_date}T${time}`);
  if (Number.isNaN(due.getTime())) return null;
  return new Date(due.getTime() - Math.max(0, leadMinutes) * 60_000);
}

export function buildReminderPlan(
  tasks: ReminderTask[],
  settings: ReminderSettings | null | undefined,
  now = new Date(),
): PlannedReminder[] {
  if (!settings?.notifications_enabled) return [];

  const leadMinutes = Math.max(0, settings.default_reminder_minutes ?? 15);
  const sound = settings.sound_enabled !== false;
  const taskReminders = tasks
    .filter(
      (task) =>
        task.reminder_enabled &&
        !task.is_archived &&
        task.status !== "done" &&
        task.status !== "cancelled",
    )
    .map((task) => {
      const at = taskReminderDate(task, leadMinutes);
      if (!at || at.getTime() <= now.getTime()) return null;
      return {
        kind: "task" as const,
        id: notificationIdForTask(task.id),
        taskId: task.id,
        title: `⏰ Rappel : ${task.title}`,
        body: `Prévu à ${String(task.due_time ?? "09:00").slice(0, 5)}`,
        at,
        sound,
      };
    })
    .filter((item): item is Exclude<typeof item, null> => item !== null)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, MAX_NATIVE_TASK_REMINDERS);

  const plan: PlannedReminder[] = [...taskReminders];

  if (settings.daily_reminder_enabled && settings.daily_reminder_time) {
    const [hour, minute] = String(settings.daily_reminder_time).split(":").map(Number);
    if (
      Number.isInteger(hour) &&
      Number.isInteger(minute) &&
      hour >= 0 &&
      hour <= 23 &&
      minute >= 0 &&
      minute <= 59
    ) {
      plan.push({
        kind: "daily",
        id: DAILY_REMINDER_ID,
        title: "🌅 Bonjour !",
        body: "Voici votre plan du jour. Allez-y, c'est parti !",
        hour,
        minute,
        sound,
      });
    }
  }

  return plan;
}
