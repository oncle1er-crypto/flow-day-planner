import { describe, expect, it } from "vitest";
import { isValidFinancePin } from "@/lib/finance-security";

describe("isValidFinancePin", () => {
  it("accepts exactly four numeric digits", () => {
    expect(isValidFinancePin("0000")).toBe(true);
    expect(isValidFinancePin("4827")).toBe(true);
  });

  it("rejects non-numeric, short, long, or spaced values", () => {
    expect(isValidFinancePin("123")).toBe(false);
    expect(isValidFinancePin("12345")).toBe(false);
    expect(isValidFinancePin("12a4")).toBe(false);
    expect(isValidFinancePin(" 1234")).toBe(false);
    expect(isValidFinancePin("1234 ")).toBe(false);
  });
});
