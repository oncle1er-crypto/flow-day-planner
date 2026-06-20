import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Habit, HabitInsert, HabitLog } from "@/lib/habit-utils";
import { toast } from "sonner";

export function useHabits() {
  return useQuery<Habit[]>({
    queryKey: ["habits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habits")
        .select("*")
        .eq("is_archived", false)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useHabitLogs(sinceISO: string) {
  return useQuery<HabitLog[]>({
    queryKey: ["habit_logs", sinceISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habit_logs")
        .select("*")
        .gte("log_date", sinceISO)
        .order("log_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<HabitInsert, "user_id">) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Non authentifié");
      const { error } = await supabase.from("habits").insert({ ...input, user_id: u.user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits"] });
      toast.success("Habitude créée");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Habit> }) => {
      const { error } = await supabase.from("habits").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["habits"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("habits").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits"] });
      qc.invalidateQueries({ queryKey: ["habit_logs"] });
      toast.success("Habitude supprimée");
    },
  });
}

export function useToggleHabitDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ habitId, date, done }: { habitId: string; date: string; done: boolean }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Non authentifié");
      if (done) {
        const { error } = await supabase
          .from("habit_logs")
          .upsert(
            { habit_id: habitId, user_id: u.user.id, log_date: date, count: 1 },
            { onConflict: "habit_id,log_date" },
          );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("habit_logs")
          .delete()
          .eq("habit_id", habitId)
          .eq("log_date", date);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["habit_logs"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}
