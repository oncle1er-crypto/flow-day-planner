export type ObligationType = "receivable" | "debt";
export type ObligationStatus = "open" | "settled" | "cancelled";

export type FinancialObligation = {
  id: string;
  user_id: string;
  type: ObligationType;
  counterparty_name: string;
  counterparty_phone: string | null;
  title: string;
  notes: string | null;
  currency: string;
  original_amount: number;
  due_date: string | null;
  status: ObligationStatus;
  settled_at: string | null;
  created_at: string;
  updated_at: string;
  paid_amount: number;
  remaining_amount: number;
  is_overdue: boolean;
};

export type FinancialPayment = {
  id: string;
  obligation_id: string;
  user_id: string;
  amount: number;
  paid_at: string;
  note: string | null;
  created_at: string;
};

export function formatMoney(amount: number, currency = "XOF") {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "XOF" ? 0 : 2,
  }).format(amount);
}

export function financeSummary(items: FinancialObligation[]) {
  const active = items.filter((item) => item.status === "open" && item.remaining_amount > 0);
  const receivables = active
    .filter((item) => item.type === "receivable")
    .reduce((sum, item) => sum + item.remaining_amount, 0);
  const debts = active
    .filter((item) => item.type === "debt")
    .reduce((sum, item) => sum + item.remaining_amount, 0);
  const overdueReceivables = active
    .filter((item) => item.type === "receivable" && item.is_overdue)
    .reduce((sum, item) => sum + item.remaining_amount, 0);
  const overdueDebts = active
    .filter((item) => item.type === "debt" && item.is_overdue)
    .reduce((sum, item) => sum + item.remaining_amount, 0);

  return { receivables, debts, overdueReceivables, overdueDebts, net: receivables - debts };
}
