import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Habit, HabitInsert, HabitLog } from "@/lib/habit-utils";
import { toast } from "sonner";
import { enqueueOp, isOnline } from "@/lib/sync-queue";

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
      const row = { ...input, user_id: u.user.id };
      if (!isOnline()) {
        const now = new Date().toISOString();
        const optimistic = {
          ...row,
          id: crypto.randomUUID(),
          created_at: now,
          updated_at: now,
        } as Habit;
        await enqueueOp({ table: "habits", action: "insert", payload: optimistic });
        return optimistic;
      }
      const { data, error } = await supabase.from("habits").insert(row).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (created) => {
      if (!isOnline()) {
        qc.setQueryData<Habit[]>(["habits"], (old) => (old ? [...old, created] : [created]));
      }
      qc.invalidateQueries({ queryKey: ["habits"] });
      toast.success(isOnline() ? "Habitude créée" : "Habitude créée (hors-ligne)");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Habit> }) => {
      if (!isOnline()) {
        await enqueueOp({ table: "habits", action: "update", payload: patch, match: { id } });
        return { id, ...patch } as Habit;
      }
      const { error } = await supabase.from("habits").update(patch).eq("id", id);
      if (error) throw error;
      return { id, ...patch } as Habit;
    },
    onSuccess: (updated) => {
      if (!isOnline()) {
        qc.setQueryData<Habit[]>(["habits"], (old) =>
          old?.map((habit) => (habit.id === updated.id ? { ...habit, ...updated } : habit)),
        );
      }
      qc.invalidateQueries({ queryKey: ["habits"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!isOnline()) {
        await enqueueOp({ table: "habits", action: "delete", match: { id } });
        return;
      }
      const { error } = await supabase.from("habits").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      if (!isOnline()) {
        qc.setQueryData<Habit[]>(["habits"], (old) => old?.filter((habit) => habit.id !== id));
      }
      qc.invalidateQueries({ queryKey: ["habits"] });
      qc.invalidateQueries({ queryKey: ["habit_logs"] });
      toast.success("Habitude supprimée");
    },
  });
}

export function useToggleHabitDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      habitId,
      date,
      done,
    }: {
      habitId: string;
      date: string;
      done: boolean;
    }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Non authentifié");
      if (done) {
        if (!isOnline()) {
          await enqueueOp({
            table: "habit_logs",
            action: "insert",
            payload: { habit_id: habitId, user_id: u.user.id, log_date: date, count: 1 },
          });
          return;
        }
        const { error } = await supabase
          .from("habit_logs")
          .upsert(
            { habit_id: habitId, user_id: u.user.id, log_date: date, count: 1 },
            { onConflict: "habit_id,log_date" },
          );
        if (error) throw error;
      } else {
        if (!isOnline()) {
          await enqueueOp({
            table: "habit_logs",
            action: "delete",
            match: { habit_id: habitId, log_date: date },
          });
          return;
        }
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
