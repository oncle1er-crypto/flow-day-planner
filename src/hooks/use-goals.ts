import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Goal, GoalInsert } from "@/lib/goal-utils";
import { toast } from "sonner";
import { enqueueOp, isOnline } from "@/lib/sync-queue";

export function useGoals() {
  return useQuery<Goal[]>({
    queryKey: ["goals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("is_archived", false)
        .order("status", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<GoalInsert, "user_id">) => {
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
        } as Goal;
        await enqueueOp({ table: "goals", action: "insert", payload: optimistic });
        return optimistic;
      }
      const { data, error } = await supabase.from("goals").insert(row).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (created) => {
      if (!isOnline()) {
        qc.setQueryData<Goal[]>(["goals"], (old) => (old ? [created, ...old] : [created]));
      }
      qc.invalidateQueries({ queryKey: ["goals"] });
      toast.success(isOnline() ? "Objectif créé" : "Objectif créé (hors-ligne)");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Goal> }) => {
      if (!isOnline()) {
        await enqueueOp({ table: "goals", action: "update", payload: patch, match: { id } });
        return { id, ...patch } as Goal;
      }
      const { error } = await supabase.from("goals").update(patch).eq("id", id);
      if (error) throw error;
      return { id, ...patch } as Goal;
    },
    onSuccess: (updated) => {
      if (!isOnline()) {
        qc.setQueryData<Goal[]>(["goals"], (old) =>
          old?.map((goal) => (goal.id === updated.id ? { ...goal, ...updated } : goal)),
        );
      }
      qc.invalidateQueries({ queryKey: ["goals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!isOnline()) {
        await enqueueOp({ table: "goals", action: "delete", match: { id } });
        return;
      }
      const { error } = await supabase.from("goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      if (!isOnline()) {
        qc.setQueryData<Goal[]>(["goals"], (old) => old?.filter((goal) => goal.id !== id));
      }
      qc.invalidateQueries({ queryKey: ["goals"] });
      toast.success("Objectif supprimé");
    },
  });
}
