import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";

export type FocusSession = Database["public"]["Tables"]["focus_sessions"]["Row"];
export type FocusSessionInsert = Database["public"]["Tables"]["focus_sessions"]["Insert"];
export type FocusKind = Database["public"]["Enums"]["focus_kind"];

export function useFocusSessions(limit = 20) {
  return useQuery<FocusSession[]>({
    queryKey: ["focus_sessions", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("focus_sessions")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateFocusSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<FocusSessionInsert, "user_id">) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Non authentifié");
      const { data, error } = await supabase
        .from("focus_sessions")
        .insert({ ...input, user_id: u.user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["focus_sessions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}