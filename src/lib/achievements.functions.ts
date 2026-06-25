import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ACHIEVEMENTS, computeXP, levelFromXP, type Stats } from "@/lib/gamification";

function computeMaxStreak(dates: string[]): number {
  if (!dates.length) return 0;
  const set = new Set(dates);
  let max = 0;
  for (const d of set) {
    let cur = 1;
    const base = new Date(d + "T00:00:00");
    while (true) {
      base.setDate(base.getDate() - 1);
      const iso = base.toISOString().slice(0, 10);
      if (set.has(iso)) cur++;
      else break;
    }
    if (cur > max) max = cur;
  }
  return max;
}

/**
 * Re-computes stats server-side using the authenticated user's data and
 * inserts only achievements whose criteria are actually satisfied. Direct
 * INSERT on user_achievements has been revoked from the authenticated role,
 * so the supabaseAdmin client is required to write here.
 */
export const syncAchievements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [tasksRes, focusRes, habitLogsRes, goalsRes, unlockedRes] = await Promise.all([
      supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "done"),
      supabase.from("focus_sessions").select("actual_seconds,kind,completed").eq("completed", true),
      supabase.from("habit_logs").select("log_date"),
      supabase.from("goals").select("id", { count: "exact", head: true }).eq("status", "done"),
      supabase.from("user_achievements").select("achievement_key"),
    ]);

    const focusRows = (focusRes.data ?? []).filter((r) => r.kind === "focus");
    const focusSeconds = focusRows.reduce((a, r) => a + (r.actual_seconds ?? 0), 0);
    const habitDates = (habitLogsRes.data ?? []).map((r) => r.log_date as string);

    const stats: Stats = {
      tasksCompleted: tasksRes.count ?? 0,
      focusSessions: focusRows.length,
      focusMinutes: Math.floor(focusSeconds / 60),
      habitLogs: habitDates.length,
      habitStreakMax: computeMaxStreak(habitDates),
      goalsCompleted: goalsRes.count ?? 0,
    };
    const level = levelFromXP(computeXP(stats)).level;

    const known = new Set((unlockedRes.data ?? []).map((u) => u.achievement_key as string));
    const toUnlock = ACHIEVEMENTS.filter((a) => !known.has(a.key) && a.unlocked(stats, level));
    if (!toUnlock.length) return { unlocked: [] as string[] };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = toUnlock.map((a) => ({ user_id: userId, achievement_key: a.key }));
    const { error } = await supabaseAdmin
      .from("user_achievements")
      .upsert(rows, { onConflict: "user_id,achievement_key", ignoreDuplicates: true });
    if (error) {
      console.error("[achievements] insert failed", error);
      throw new Error("Impossible d'enregistrer les badges.");
    }
    return { unlocked: toUnlock.map((a) => a.key) };
  });