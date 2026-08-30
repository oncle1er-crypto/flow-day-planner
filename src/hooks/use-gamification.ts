import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ACHIEVEMENTS, computeXP, levelFromXP, type Stats } from "@/lib/gamification";
import { syncAchievements } from "@/lib/achievements.functions";
import { toast } from "sonner";
import { format } from "date-fns";

const database = supabase as unknown as SupabaseClient;

export function useGamification() {
  const qc = useQueryClient();

  const statsQuery = useQuery({
    queryKey: ["gamification", "stats"],
    queryFn: async (): Promise<Stats> => {
      const { data, error } = await database.rpc("get_my_gamification_stats");
      if (error) {
        // Backward-compatible fallback while a deployment is applying the new
        // aggregate RPC migration. It can be removed after every environment
        // reports the migration as installed.
        const [tasksRes, focusRes, habitLogsRes, goalsRes] = await Promise.all([
          supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "done"),
          supabase
            .from("focus_sessions")
            .select("actual_seconds,kind")
            .eq("completed", true)
            .eq("kind", "focus"),
          supabase.from("habit_logs").select("log_date"),
          supabase.from("goals").select("id", { count: "exact", head: true }).eq("status", "done"),
        ]);
        const distinctDates = [...new Set((habitLogsRes.data ?? []).map((item) => item.log_date))];
        const dateSet = new Set(distinctDates);
        let habitStreakMax = 0;
        for (const value of distinctDates) {
          const cursor = new Date(`${value}T12:00:00`);
          let streak = 1;
          while (true) {
            cursor.setDate(cursor.getDate() - 1);
            const key = format(cursor, "yyyy-MM-dd");
            if (!dateSet.has(key)) break;
            streak++;
          }
          habitStreakMax = Math.max(habitStreakMax, streak);
        }
        return {
          tasksCompleted: tasksRes.count ?? 0,
          focusSessions: focusRes.data?.length ?? 0,
          focusMinutes: Math.floor(
            (focusRes.data ?? []).reduce((sum, item) => sum + item.actual_seconds, 0) / 60,
          ),
          habitLogs: habitLogsRes.data?.length ?? 0,
          habitStreakMax,
          goalsCompleted: goalsRes.count ?? 0,
        };
      }
      const row = Array.isArray(data) ? data[0] : data;
      return {
        tasksCompleted: Number(row?.tasks_completed ?? 0),
        focusSessions: Number(row?.focus_sessions ?? 0),
        focusMinutes: Number(row?.focus_minutes ?? 0),
        habitLogs: Number(row?.habit_logs ?? 0),
        habitStreakMax: Number(row?.habit_streak_max ?? 0),
        goalsCompleted: Number(row?.goals_completed ?? 0),
      };
    },
  });

  const unlockedQuery = useQuery({
    queryKey: ["gamification", "unlocked"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_achievements")
        .select("achievement_key,unlocked_at");
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
    const toUnlock = ACHIEVEMENTS.filter(
      (a) => !known.has(a.key) && a.unlocked(stats, level.level),
    );
    if (!toUnlock.length) return;
    (async () => {
      try {
        const res = await syncAchievements();
        const unlockedKeys = new Set(res.unlocked ?? []);
        const awarded = ACHIEVEMENTS.filter((a) => unlockedKeys.has(a.key));
        if (awarded.length) {
          awarded.forEach((a) =>
            toast.success(`🏆 Badge débloqué : ${a.name}`, { description: a.description }),
          );
          qc.invalidateQueries({ queryKey: ["gamification", "unlocked"] });
        }
      } catch (err) {
        console.error("[gamification] sync failed", err);
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
