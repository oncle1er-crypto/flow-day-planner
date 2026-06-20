import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Task, TaskInsert, TaskUpdate, Status } from "@/lib/task-utils";
import { toast } from "sonner";
import { enqueueOp, isOnline } from "@/lib/sync-queue";

export function useTasks(filter?: { dueOn?: string; range?: [string, string]; status?: Status[]; overdue?: boolean }) {
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
      const row = { ...input, user_id: u.user.id } as TaskInsert;
      if (!isOnline()) {
        const tempId = crypto.randomUUID();
        const optimistic = {
          ...row,
          id: tempId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as unknown as Task;
        await enqueueOp({ table: "tasks", action: "insert", payload: { ...row, id: tempId } });
        return optimistic;
      }
      const { data, error } = await supabase.from("tasks").insert(row).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(isOnline() ? "Tâche créée" : "Tâche créée (hors-ligne)");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TaskUpdate }) => {
      if (!isOnline()) {
        await enqueueOp({ table: "tasks", action: "update", payload: patch as Record<string, unknown>, match: { id } });
        return { id, ...patch } as unknown as Task;
      }
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
      const patch = { status: done ? "done" : "todo", completed_at: done ? new Date().toISOString() : null };
      // Optimistic cache update so UI flips instantly even offline
      qc.setQueriesData<Task[]>({ queryKey: ["tasks"] }, (old) =>
        old?.map((t) => (t.id === id ? ({ ...t, ...patch } as Task) : t)) ?? old,
      );
      if (!isOnline()) {
        await enqueueOp({ table: "tasks", action: "update", payload: patch, match: { id } });
        return;
      }
      const { error } = await supabase.from("tasks").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!isOnline()) {
        await enqueueOp({ table: "tasks", action: "delete", match: { id } });
        return;
      }
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Tâche supprimée");
    },
  });
}