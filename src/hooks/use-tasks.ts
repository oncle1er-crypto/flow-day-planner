import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Task, TaskInsert, TaskUpdate } from "@/lib/task-utils";
import { toast } from "sonner";

export function useTasks(filter?: { dueOn?: string; range?: [string, string]; status?: string[]; overdue?: boolean }) {
  return useQuery<Task[]>({
    queryKey: ["tasks", filter],
    queryFn: async () => {
      let q = supabase.from("tasks").select("*").eq("is_archived", false).order("due_date", { ascending: true, nullsFirst: false }).order("priority", { ascending: false }).order("created_at", { ascending: false });
      if (filter?.dueOn) q = q.eq("due_date", filter.dueOn);
      if (filter?.range) q = q.gte("due_date", filter.range[0]).lte("due_date", filter.range[1]);
      if (filter?.status) q = q.in("status", filter.status);
      if (filter?.overdue) q = q.lt("due_date", new Date().toISOString().slice(0, 10)).neq("status", "done").neq("status", "cancelled");
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<TaskInsert, "user_id">) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Non authentifié");
      const { data, error } = await supabase.from("tasks").insert({ ...input, user_id: u.user.id }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Tâche créée");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TaskUpdate }) => {
      const { data, error } = await supabase.from("tasks").update(patch).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useToggleTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ status: done ? "done" : "todo", completed_at: done ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Tâche supprimée");
    },
  });
}