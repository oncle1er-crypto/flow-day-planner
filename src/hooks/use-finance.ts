import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { FinancialObligation, ObligationType } from "@/lib/finance";
import { toast } from "sonner";

const financeDb = supabase as unknown as SupabaseClient;

export type NewObligation = {
  type: ObligationType;
  counterparty_name: string;
  counterparty_phone?: string;
  title: string;
  notes?: string;
  original_amount: number;
  due_date?: string;
};

export function useFinancialObligations(enabled = true) {
  return useQuery<FinancialObligation[]>({
    queryKey: ["financial-obligations"],
    enabled,
    queryFn: async () => {
      const { data, error } = await financeDb
        .from("financial_obligation_balances")
        .select("*")
        .order("is_overdue", { ascending: false })
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...row,
        original_amount: Number(row.original_amount),
        paid_amount: Number(row.paid_amount),
        remaining_amount: Number(row.remaining_amount),
      })) as FinancialObligation[];
    },
  });
}

export function useCreateFinancialObligation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewObligation) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Non authentifié");
      if (!input.counterparty_name.trim() || !input.title.trim()) {
        throw new Error("Le nom et le motif sont obligatoires");
      }
      if (!Number.isFinite(input.original_amount) || input.original_amount <= 0) {
        throw new Error("Le montant doit être supérieur à zéro");
      }
      const { error } = await financeDb.from("financial_obligations").insert({
        user_id: auth.user.id,
        type: input.type,
        counterparty_name: input.counterparty_name.trim(),
        counterparty_phone: input.counterparty_phone?.trim() || null,
        title: input.title.trim(),
        notes: input.notes?.trim() || null,
        original_amount: input.original_amount,
        due_date: input.due_date || null,
        currency: "XOF",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial-obligations"] });
      toast.success("Opération financière enregistrée");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useAddFinancialPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      obligation,
      amount,
      note,
    }: {
      obligation: FinancialObligation;
      amount: number;
      note?: string;
    }) => {
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Montant invalide");
      if (amount > obligation.remaining_amount) {
        throw new Error("Le paiement ne peut pas dépasser le reste à payer");
      }

      const { error } = await financeDb.rpc("record_financial_payment", {
        target_obligation_id: obligation.id,
        payment_amount: amount,
        payment_note: note?.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial-obligations"] });
      toast.success("Paiement enregistré");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateFinancialStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: "open" | "settled" | "cancelled";
    }) => {
      const { error } = await financeDb
        .from("financial_obligations")
        .update({ status, settled_at: status === "settled" ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["financial-obligations"] }),
    onError: (error: Error) => toast.error(error.message),
  });
}
