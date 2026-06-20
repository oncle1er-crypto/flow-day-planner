import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Goal, GoalInsert } from "@/lib/goal-utils";
import { toast } from "sonner";

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
      const { error } = await supabase.from("goals").insert({ ...input, user_id: u.user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      toast.success("Objectif créé");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Goal> }) => {
      const { error } = await supabase.from("goals").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      toast.success("Objectif supprimé");
    },
  });
}
