import type { Database } from "@/integrations/supabase/types";

export type Habit = Database["public"]["Tables"]["habits"]["Row"];
export type HabitInsert = Database["public"]["Tables"]["habits"]["Insert"];
export type HabitLog = Database["public"]["Tables"]["habit_logs"]["Row"];

export function isHabitDueOn(habit: Pick<Habit, "days_of_week">, date: Date): boolean {
  return habit.days_of_week.includes(date.getDay());
}

/** Compute current streak (consecutive due-days completed up to today). */
export function computeStreak(habit: Pick<Habit, "days_of_week">, logs: HabitLog[]): number {
  const set = new Set(logs.map((l) => l.log_date));
  let streak = 0;
  const cur = new Date();
  cur.setHours(0, 0, 0, 0);
  // If today is due and not done, start from yesterday so the user doesn't lose streak before EOD
  const todayKey = cur.toISOString().slice(0, 10);
  if (isHabitDueOn(habit, cur) && !set.has(todayKey)) {
    cur.setDate(cur.getDate() - 1);
  }
  for (let i = 0; i < 400; i++) {
    if (!isHabitDueOn(habit, cur)) {
      cur.setDate(cur.getDate() - 1);
      continue;
    }
    const key = cur.toISOString().slice(0, 10);
    if (set.has(key)) {
      streak++;
      cur.setDate(cur.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export function last7Days(): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  for (let i = 6; i >= 0; i--) {
    const x = new Date(d);
    x.setDate(d.getDate() - i);
    out.push(x.toISOString().slice(0, 10));
  }
  return out;
}

export const DAY_LABELS = ["D", "L", "M", "M", "J", "V", "S"];
