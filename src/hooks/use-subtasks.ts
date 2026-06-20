import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Subtask } from "@/lib/task-utils";
import { toast } from "sonner";

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
      const { data, error } = await supabase
        .from("subtasks")
        .select("*")
        .in("task_id", taskIds);
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
      const { error } = await supabase.from("subtasks").insert({
        task_id: taskId,
        user_id: u.user.id,
        title,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
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
      const { error } = await supabase
        .from("subtasks")
        .update({ is_done: completed, completed_at: completed ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["subtasks", v.taskId] });
      qc.invalidateQueries({ queryKey: ["subtasks-by-tasks"] });
    },
  });
}

export function useDeleteSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; taskId: string }) => {
      const { error } = await supabase.from("subtasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["subtasks", v.taskId] });
      qc.invalidateQueries({ queryKey: ["subtasks-by-tasks"] });
    },
  });
}
