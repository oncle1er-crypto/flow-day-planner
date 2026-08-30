import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Category } from "@/lib/task-utils";
import { toast } from "sonner";
import { enqueueOp, isOnline } from "@/lib/sync-queue";

export function useCategories() {
  return useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Le nom de la catégorie est obligatoire.");
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Utilisateur non authentifié.");
      const row = { user_id: auth.user.id, name: trimmed, color, icon: "folder" };
      if (!isOnline()) {
        const now = new Date().toISOString();
        const optimistic = {
          ...row,
          id: crypto.randomUUID(),
          is_default: false,
          created_at: now,
          updated_at: now,
        } as Category;
        await enqueueOp({ table: "categories", action: "insert", payload: optimistic });
        return optimistic;
      }
      const { data, error } = await supabase.from("categories").insert(row).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (created) => {
      if (!isOnline()) {
        queryClient.setQueryData<Category[]>(["categories"], (old) =>
          old ? [...old, created] : [created],
        );
      }
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Catégorie créée");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name: string; color: string }) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Le nom de la catégorie est obligatoire.");
      if (!isOnline()) {
        await enqueueOp({
          table: "categories",
          action: "update",
          payload: { name: trimmed, color },
          match: { id },
        });
        return { id, name: trimmed, color };
      }
      const { error } = await supabase
        .from("categories")
        .update({ name: trimmed, color })
        .eq("id", id);
      if (error) throw error;
      return { id, name: trimmed, color };
    },
    onSuccess: (updated) => {
      if (!isOnline()) {
        queryClient.setQueryData<Category[]>(["categories"], (old) =>
          old?.map((category) =>
            category.id === updated.id ? { ...category, ...updated } : category,
          ),
        );
      }
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Catégorie mise à jour");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!isOnline()) {
        await enqueueOp({ table: "categories", action: "delete", match: { id } });
        return;
      }
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      if (!isOnline()) {
        queryClient.setQueryData<Category[]>(["categories"], (old) =>
          old?.filter((category) => category.id !== id),
        );
      }
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Catégorie supprimée");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
