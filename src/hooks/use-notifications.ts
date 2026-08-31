import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { NotificationRow } from "@/lib/task-utils";
import { toast } from "sonner";
import { enqueueOp, isOnline } from "@/lib/sync-queue";

export function useNotifications() {
  return useQuery<NotificationRow[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 15_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}

export function useUnreadCount() {
  const { data } = useNotifications();
  return data?.filter((n) => !n.is_read).length ?? 0;
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!isOnline()) {
        await enqueueOp({
          table: "notifications",
          action: "update",
          payload: { is_read: true },
          match: { id },
        });
        return;
      }
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      if (!isOnline()) {
        qc.setQueryData<NotificationRow[]>(["notifications"], (old) =>
          old?.map((notification) =>
            notification.id === id ? { ...notification, is_read: true } : notification,
          ),
        );
      }
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Impossible de marquer la notification comme lue."),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!isOnline()) {
        await enqueueOp({
          table: "notifications",
          action: "update",
          payload: { is_read: true },
          match: { is_read: false },
        });
        return;
      }
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      if (!isOnline()) {
        qc.setQueryData<NotificationRow[]>(["notifications"], (old) =>
          old?.map((notification) => ({ ...notification, is_read: true })),
        );
      }
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Impossible de marquer toutes les notifications comme lues."),
  });
}
