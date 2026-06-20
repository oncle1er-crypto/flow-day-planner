import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ACHIEVEMENTS, computeXP, levelFromXP, type Stats } from "@/lib/gamification";
import { toast } from "sonner";

function computeMaxStreak(dates: string[]): number {
  if (!dates.length) return 0;
  const set = new Set(dates);
  let max = 0;
  for (const d of set) {
    // count consecutive previous days ending at d
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

export function useGamification() {
  const qc = useQueryClient();

  const statsQuery = useQuery({
    queryKey: ["gamification", "stats"],
    queryFn: async (): Promise<Stats> => {
      const [tasksRes, focusRes, habitLogsRes, goalsRes] = await Promise.all([
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "done"),
        supabase.from("focus_sessions").select("actual_seconds,kind,completed").eq("completed", true),
        supabase.from("habit_logs").select("log_date"),
        supabase.from("goals").select("id", { count: "exact", head: true }).eq("status", "done"),
      ]);
      const focusRows = (focusRes.data ?? []).filter((r) => r.kind === "focus");
      const focusSeconds = focusRows.reduce((a, r) => a + (r.actual_seconds ?? 0), 0);
      const habitDates = (habitLogsRes.data ?? []).map((r) => r.log_date as string);
      return {
        tasksCompleted: tasksRes.count ?? 0,
        focusSessions: focusRows.length,
        focusMinutes: Math.floor(focusSeconds / 60),
        habitLogs: habitDates.length,
        habitStreakMax: computeMaxStreak(habitDates),
        goalsCompleted: goalsRes.count ?? 0,
      };
    },
  });

  const unlockedQuery = useQuery({
    queryKey: ["gamification", "unlocked"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_achievements").select("achievement_key,unlocked_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const xp = useMemo(() => (statsQuery.data ? computeXP(statsQuery.data) : 0), [statsQuery.data]);
  const level = useMemo(() => levelFromXP(xp), [xp]);

  // Detect and persist newly unlocked achievements
  useEffect(() => {
    const stats = statsQuery.data;
    const unlocked = unlockedQuery.data;
    if (!stats || !unlocked) return;
    const known = new Set(unlocked.map((u) => u.achievement_key));
    const toUnlock = ACHIEVEMENTS.filter((a) => !known.has(a.key) && a.unlocked(stats, level.level));
    if (!toUnlock.length) return;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const rows = toUnlock.map((a) => ({ user_id: u.user!.id, achievement_key: a.key }));
      const { error } = await supabase.from("user_achievements").insert(rows);
      if (!error) {
        toUnlock.forEach((a) => toast.success(`🏆 Badge débloqué : ${a.name}`, { description: a.description }));
        qc.invalidateQueries({ queryKey: ["gamification", "unlocked"] });
      }
    })();
  }, [statsQuery.data, unlockedQuery.data, level.level, qc]);

  return {
    stats: statsQuery.data,
    xp,
    level,
    unlocked: new Set((unlockedQuery.data ?? []).map((u) => u.achievement_key)),
    isLoading: statsQuery.isLoading || unlockedQuery.isLoading,
  };
}