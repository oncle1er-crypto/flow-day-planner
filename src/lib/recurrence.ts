import type { Task, TaskInsert } from "@/lib/task-utils";

export type RecurrenceType = "none" | "daily" | "weekdays" | "weekly" | "monthly" | "yearly" | "custom";

export type RecurrenceConfig = {
  /** Repeat every N periods (daily/weekly/monthly/yearly). Defaults to 1. */
  interval?: number;
  /** 0 = Sunday … 6 = Saturday. Used by `custom`. */
  days_of_week?: number[];
  /** Hard cap on the total number of occurrences in the series (root included). */
  max_occurrences?: number;
};

export const RECURRENCE_LABEL: Record<RecurrenceType, string> = {
  none: "Jamais",
  daily: "Chaque jour",
  weekdays: "Jours ouvrés (lun-ven)",
  weekly: "Chaque semaine",
  monthly: "Chaque mois",
  yearly: "Chaque année",
  custom: "Jours précis de la semaine",
};

/** Pure Y-M-D helpers — no Date/timezone drift. */
function parse(dateStr: string): { y: number; m: number; d: number } {
  const [y, m, d] = dateStr.split("-").map(Number);
  return { y: y ?? 1970, m: m ?? 1, d: d ?? 1 };
}
function fmt(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
function addDays(dateStr: string, n: number): string {
  const { y, m, d } = parse(dateStr);
  const t = Date.UTC(y, m - 1, d) + n * 86400000;
  const dt = new Date(t);
  return fmt(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}
function addMonths(dateStr: string, n: number): string {
  const { y, m, d } = parse(dateStr);
  const total = (y * 12 + (m - 1)) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return fmt(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}
/** 0 = Sunday … 6 = Saturday */
export function weekdayOf(dateStr: string): number {
  const { y, m, d } = parse(dateStr);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function normalizeConfig(config: unknown): RecurrenceConfig {
  if (!config || typeof config !== "object") return {};
  const c = config as RecurrenceConfig;
  const days = Array.isArray(c.days_of_week)
    ? [...new Set(c.days_of_week.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort()
    : undefined;
  const interval = Number.isInteger(c.interval) && (c.interval as number) > 0 ? c.interval : 1;
  const max =
    Number.isInteger(c.max_occurrences) && (c.max_occurrences as number) > 0 ? c.max_occurrences : undefined;
  return { interval, ...(days && days.length ? { days_of_week: days } : {}), ...(max ? { max_occurrences: max } : {}) };
}

/**
 * Computes the due date of the occurrence that follows `fromDate`.
 * Returns null when the recurrence cannot produce another date.
 */
export function nextDueDate(
  fromDate: string,
  recurrence: RecurrenceType,
  config?: unknown,
): string | null {
  if (!fromDate || recurrence === "none") return null;
  const { interval = 1, days_of_week } = normalizeConfig(config);

  switch (recurrence) {
    case "daily":
      return addDays(fromDate, interval);
    case "weekly":
      return addDays(fromDate, 7 * interval);
    case "monthly":
      return addMonths(fromDate, interval);
    case "yearly":
      return addMonths(fromDate, 12 * interval);
    case "weekdays": {
      let next = addDays(fromDate, 1);
      for (let i = 0; i < 7; i++) {
        const wd = weekdayOf(next);
        if (wd !== 0 && wd !== 6) return next;
        next = addDays(next, 1);
      }
      return null;
    }
    case "custom": {
      if (!days_of_week || days_of_week.length === 0) return null;
      let next = fromDate;
      for (let i = 0; i < 371; i++) {
        next = addDays(next, 1);
        if (days_of_week.includes(weekdayOf(next))) return next;
      }
      return null;
    }
    default:
      return null;
  }
}

export type RecurringTaskSource = Pick<
  Task,
  | "id"
  | "user_id"
  | "title"
  | "description"
  | "due_date"
  | "due_time"
  | "priority"
  | "category_id"
  | "tags"
  | "color"
  | "icon"
  | "notes"
  | "reminder_enabled"
  | "recurrence"
  | "recurrence_config"
  | "recurrence_end_date"
> & {
  recurrence_parent_id?: string | null;
  occurrence_index?: number | null;
};

/**
 * Builds the row for the next occurrence of a recurring task, or null when the
 * series is finished (no recurrence, no due date, past end date, max reached).
 * Insertion is made idempotent by the DB unique index on
 * (user_id, COALESCE(recurrence_parent_id, id), due_date).
 */
export function buildNextOccurrence(task: RecurringTaskSource): TaskInsert | null {
  const recurrence = (task.recurrence ?? "none") as RecurrenceType;
  if (recurrence === "none" || !task.due_date) return null;

  const cfg = normalizeConfig(task.recurrence_config);
  const index = (task.occurrence_index ?? 0) + 1;
  if (cfg.max_occurrences && index + 1 > cfg.max_occurrences) return null;

  const nextDate = nextDueDate(task.due_date, recurrence, task.recurrence_config);
  if (!nextDate) return null;
  if (task.recurrence_end_date && nextDate > task.recurrence_end_date) return null;

  const reminderAt =
    task.reminder_enabled && nextDate
      ? new Date(`${nextDate}T${(task.due_time ?? "09:00:00").slice(0, 5)}:00`).toISOString()
      : null;

  return {
    user_id: task.user_id,
    title: task.title,
    description: task.description ?? null,
    due_date: nextDate,
    due_time: task.due_time ?? null,
    priority: task.priority,
    status: "todo",
    category_id: task.category_id ?? null,
    tags: task.tags ?? [],
    color: task.color ?? null,
    icon: task.icon ?? null,
    notes: task.notes ?? null,
    reminder_enabled: task.reminder_enabled,
    reminder_at: reminderAt,
    recurrence: task.recurrence,
    recurrence_config: task.recurrence_config,
    recurrence_end_date: task.recurrence_end_date ?? null,
    recurrence_parent_id: task.recurrence_parent_id ?? task.id,
    occurrence_index: index,
  } as TaskInsert;
}
