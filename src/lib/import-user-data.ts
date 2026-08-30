import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasFinancePin, isFinanceSessionUnlocked } from "./finance-security";

const database = supabase as unknown as SupabaseClient;

type JsonRecord = Record<string, unknown>;

type ImportPayload = {
  application: string;
  schema_version: number;
  profile?: JsonRecord | null;
  settings?: JsonRecord | null;
  categories?: JsonRecord[];
  tasks?: JsonRecord[];
  subtasks?: JsonRecord[];
  habits?: JsonRecord[];
  habit_logs?: JsonRecord[];
  goals?: JsonRecord[];
  focus_sessions?: JsonRecord[];
  achievements?: JsonRecord[];
  notifications?: JsonRecord[];
  financial_obligations?: JsonRecord[];
  financial_payments?: JsonRecord[];
};

const TABLES = [
  "categories",
  "tasks",
  "subtasks",
  "habits",
  "habit_logs",
  "goals",
  "focus_sessions",
  "user_achievements",
  "notifications",
  "financial_obligations",
  "financial_payments",
] as const;

const PAYLOAD_KEYS: Record<(typeof TABLES)[number], keyof ImportPayload> = {
  categories: "categories",
  tasks: "tasks",
  subtasks: "subtasks",
  habits: "habits",
  habit_logs: "habit_logs",
  goals: "goals",
  focus_sessions: "focus_sessions",
  user_achievements: "achievements",
  notifications: "notifications",
  financial_obligations: "financial_obligations",
  financial_payments: "financial_payments",
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseFlowDayImport(text: string): ImportPayload {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("Le fichier n’est pas un document JSON valide.");
  }
  if (!isRecord(value) || value.application !== "Flow Day Planner") {
    throw new Error("Ce fichier n’est pas un export Flow Day Planner.");
  }
  const version = Number(value.schema_version);
  if (!Number.isInteger(version) || version < 1 || version > 2) {
    throw new Error("Version d’export non prise en charge.");
  }
  for (const key of Object.values(PAYLOAD_KEYS)) {
    const rows = value[key];
    if (rows !== undefined && (!Array.isArray(rows) || rows.some((row) => !isRecord(row)))) {
      throw new Error(`La section ${String(key)} est invalide.`);
    }
  }
  return value as ImportPayload;
}

function rowsForUser(rows: JsonRecord[] | undefined, userId: string) {
  return (rows ?? []).map((row) => ({ ...row, user_id: userId }));
}

export async function restoreCurrentUserData(payload: ImportPayload) {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error("Utilisateur non authentifié.");
  const userId = auth.user.id;
  const restored: Record<string, number> = {};
  const hasFinancialRows =
    (payload.financial_obligations?.length ?? 0) > 0 ||
    (payload.financial_payments?.length ?? 0) > 0;
  if (hasFinancialRows && (await hasFinancePin()) && !isFinanceSessionUnlocked()) {
    throw new Error(
      "Déverrouillez d’abord le module Finances afin de restaurer les données financières.",
    );
  }

  if (payload.profile) {
    const row = { ...payload.profile, id: userId, email: auth.user.email ?? payload.profile.email };
    const { error } = await database.from("profiles").upsert(row);
    if (error) throw new Error(`Profil : ${error.message}`);
    restored.profile = 1;
  }
  if (payload.settings) {
    const row = { ...payload.settings, user_id: userId };
    const { error } = await database.from("user_settings").upsert(row);
    if (error) throw new Error(`Paramètres : ${error.message}`);
    restored.settings = 1;
  }

  // Keep foreign-key order: parents are restored before their dependent rows.
  for (const table of TABLES) {
    const rows = rowsForUser(payload[PAYLOAD_KEYS[table]] as JsonRecord[] | undefined, userId);
    if (rows.length === 0) continue;
    const target = database.from(table);
    const { error } = await target.upsert(rows);
    if (error) throw new Error(`${table} : ${error.message}`);
    restored[table] = rows.length;
  }

  return restored;
}
