import { describe, expect, it } from "vitest";
import { financeSummary, type FinancialObligation } from "@/lib/finance";

function obligation(
  type: "receivable" | "debt",
  remaining_amount: number,
  is_overdue = false,
  status: "open" | "settled" | "cancelled" = "open",
): FinancialObligation {
  return {
    id: crypto.randomUUID(),
    user_id: "user",
    type,
    counterparty_name: "Test",
    counterparty_phone: null,
    title: "Test",
    notes: null,
    currency: "XOF",
    original_amount: remaining_amount,
    due_date: null,
    status,
    settled_at: null,
    created_at: "2026-08-29T00:00:00Z",
    updated_at: "2026-08-29T00:00:00Z",
    paid_amount: 0,
    remaining_amount,
    is_overdue,
  };
}

describe("financeSummary", () => {
  it("separates receivables and debts and calculates net position", () => {
    const result = financeSummary([
      obligation("receivable", 150_000),
      obligation("receivable", 70_000, true),
      obligation("debt", 80_000),
    ]);

    expect(result.receivables).toBe(220_000);
    expect(result.debts).toBe(80_000);
    expect(result.net).toBe(140_000);
    expect(result.overdueReceivables).toBe(70_000);
  });

  it("excludes settled and cancelled obligations", () => {
    const result = financeSummary([
      obligation("receivable", 100_000, false, "settled"),
      obligation("debt", 50_000, true, "cancelled"),
    ]);

    expect(result.receivables).toBe(0);
    expect(result.debts).toBe(0);
    expect(result.overdueDebts).toBe(0);
    expect(result.net).toBe(0);
  });
});
