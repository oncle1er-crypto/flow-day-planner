import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Subtask } from "@/lib/task-utils";
import { toast } from "sonner";
import { enqueueOp, isOnline } from "@/lib/sync-queue";

export function useSubtasks(taskId?: string) {
  return useQuery<Subtask[]>({
    queryKey: ["subtasks", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subtasks")
        .select("*")
        .eq("task_id", taskId!)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSubtasksByTasks(taskIds: string[]) {
  return useQuery<Record<string, Subtask[]>>({
    queryKey: ["subtasks-by-tasks", [...taskIds].sort().join(",")],
    enabled: taskIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("subtasks").select("*").in("task_id", taskIds);
      if (error) throw error;
      const map: Record<string, Subtask[]> = {};
      (data ?? []).forEach((s) => {
        (map[s.task_id] ||= []).push(s);
      });
      return map;
    },
  });
}

export function useCreateSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, title }: { taskId: string; title: string }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Non authentifié");
      const row = {
        task_id: taskId,
        user_id: u.user.id,
        title: title.trim(),
      };
      if (!row.title) throw new Error("Le titre est obligatoire.");
      if (!isOnline()) {
        const optimistic = {
          ...row,
          id: crypto.randomUUID(),
          is_done: false,
          position: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as Subtask;
        await enqueueOp({ table: "subtasks", action: "insert", payload: optimistic });
        return optimistic;
      }
      const { data, error } = await supabase.from("subtasks").insert(row).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (created, v) => {
      if (!isOnline()) {
        qc.setQueryData<Subtask[]>(["subtasks", v.taskId], (old) =>
          old ? [...old, created] : [created],
        );
      }
      qc.invalidateQueries({ queryKey: ["subtasks", v.taskId] });
      qc.invalidateQueries({ queryKey: ["subtasks-by-tasks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useToggleSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, completed }: { id: string; taskId: string; completed: boolean }) => {
      if (!isOnline()) {
        await enqueueOp({
          table: "subtasks",
          action: "update",
          payload: { is_done: completed },
          match: { id },
        });
        return;
      }
      const { error } = await supabase.from("subtasks").update({ is_done: completed }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      if (!isOnline()) {
        qc.setQueryData<Subtask[]>(["subtasks", v.taskId], (old) =>
          old?.map((subtask) =>
            subtask.id === v.id ? { ...subtask, is_done: v.completed } : subtask,
          ),
        );
      }
      qc.invalidateQueries({ queryKey: ["subtasks", v.taskId] });
      qc.invalidateQueries({ queryKey: ["subtasks-by-tasks"] });
    },
  });
}

export function useDeleteSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; taskId: string }) => {
      if (!isOnline()) {
        await enqueueOp({ table: "subtasks", action: "delete", match: { id } });
        return;
      }
      const { error } = await supabase.from("subtasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      if (!isOnline()) {
        qc.setQueryData<Subtask[]>(["subtasks", v.taskId], (old) =>
          old?.filter((subtask) => subtask.id !== v.id),
        );
      }
      qc.invalidateQueries({ queryKey: ["subtasks", v.taskId] });
      qc.invalidateQueries({ queryKey: ["subtasks-by-tasks"] });
    },
  });
}
