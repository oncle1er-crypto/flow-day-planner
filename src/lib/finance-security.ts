import { supabase } from "@/integrations/supabase/client";

const UNLOCK_KEY = "flow-day-finance-unlocked-until";
const UNLOCK_DURATION_MS = 10 * 60 * 1000;

type PinVerification = {
  ok: boolean;
  reason: "verified" | "wrong_pin" | "locked" | "not_configured" | "invalid_format";
  remaining_attempts?: number;
  locked_until?: string;
};

type UntypedSupabase = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

const financeApi = supabase as unknown as UntypedSupabase;

export function isValidFinancePin(pin: string) {
  return /^\d{4}$/.test(pin);
}

export async function hasFinancePin() {
  const { data, error } = await financeApi.rpc("has_finance_pin");
  if (error) throw new Error(error.message);
  return data === true;
}

export async function setFinancePin(pin: string) {
  if (!isValidFinancePin(pin)) throw new Error("Le code doit contenir exactement 4 chiffres");
  const { error } = await financeApi.rpc("set_finance_pin", { new_pin: pin });
  if (error) throw new Error(error.message);
  lockFinanceSession();
}

export async function changeFinancePin(currentPin: string, newPin: string) {
  if (!isValidFinancePin(currentPin) || !isValidFinancePin(newPin)) {
    throw new Error("Le code doit contenir exactement 4 chiffres");
  }
  const { error } = await financeApi.rpc("change_finance_pin", {
    current_pin: currentPin,
    new_pin: newPin,
  });
  if (error) throw new Error(error.message);
  lockFinanceSession();
}

export async function verifyFinancePin(pin: string): Promise<PinVerification> {
  if (!isValidFinancePin(pin)) {
    return { ok: false, reason: "invalid_format", remaining_attempts: 0 };
  }
  const { data, error } = await financeApi.rpc("verify_finance_pin", { candidate_pin: pin });
  if (error) throw new Error(error.message);
  const result = data as PinVerification;
  if (result.ok) unlockFinanceSession();
  return result;
}

export async function lockFinanceAccess() {
  const { error } = await financeApi.rpc("lock_finance");
  lockFinanceSession();
  if (error) throw new Error(error.message);
}

export function isFinanceSessionUnlocked() {
  if (typeof window === "undefined") return false;
  const unlockedUntil = Number(sessionStorage.getItem(UNLOCK_KEY) ?? 0);
  if (!Number.isFinite(unlockedUntil) || unlockedUntil <= Date.now()) {
    lockFinanceSession();
    return false;
  }
  return true;
}

export function unlockFinanceSession() {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(UNLOCK_KEY, String(Date.now() + UNLOCK_DURATION_MS));
  }
}

export function lockFinanceSession() {
  if (typeof window !== "undefined") sessionStorage.removeItem(UNLOCK_KEY);
}
