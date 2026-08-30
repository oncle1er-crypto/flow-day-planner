import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasFinancePin, isFinanceSessionUnlocked } from "./finance-security";

const database = supabase as unknown as SupabaseClient;

function assertNoError(error: { message: string } | null, label: string) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

export async function exportCurrentUserData(): Promise<void> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error("Utilisateur non authentifié.");
  const userId = auth.user.id;
  if ((await hasFinancePin()) && !isFinanceSessionUnlocked()) {
    throw new Error(
      "Déverrouillez d’abord le module Finances afin que l’export puisse inclure les données financières.",
    );
  }

  const [
    profile,
    settings,
    categories,
    tasks,
    subtasks,
    habits,
    habitLogs,
    goals,
    focusSessions,
    achievements,
    notifications,
    financialObligations,
    financialPayments,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("categories").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("tasks").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("subtasks").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("habits").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("habit_logs").select("*").eq("user_id", userId).order("log_date"),
    supabase.from("goals").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("focus_sessions").select("*").eq("user_id", userId).order("started_at"),
    supabase.from("user_achievements").select("*").eq("user_id", userId).order("unlocked_at"),
    supabase.from("notifications").select("*").eq("user_id", userId).order("created_at"),
    database.from("financial_obligations").select("*").eq("user_id", userId).order("created_at"),
    database.from("financial_payments").select("*").eq("user_id", userId).order("paid_at"),
  ]);

  assertNoError(profile.error, "Profil");
  assertNoError(settings.error, "Paramètres");
  assertNoError(categories.error, "Catégories");
  assertNoError(tasks.error, "Tâches");
  assertNoError(subtasks.error, "Sous-tâches");
  assertNoError(habits.error, "Habitudes");
  assertNoError(habitLogs.error, "Historique des habitudes");
  assertNoError(goals.error, "Objectifs");
  assertNoError(focusSessions.error, "Sessions focus");
  assertNoError(achievements.error, "Récompenses");
  assertNoError(notifications.error, "Notifications");
  assertNoError(financialObligations.error, "Opérations financières");
  assertNoError(financialPayments.error, "Paiements financiers");

  const payload = {
    application: "Flow Day Planner",
    schema_version: 2,
    exported_at: new Date().toISOString(),
    account: {
      id: userId,
      email: auth.user.email ?? null,
      created_at: auth.user.created_at,
    },
    profile: profile.data,
    settings: settings.data,
    categories: categories.data ?? [],
    tasks: tasks.data ?? [],
    subtasks: subtasks.data ?? [],
    habits: habits.data ?? [],
    habit_logs: habitLogs.data ?? [],
    goals: goals.data ?? [],
    focus_sessions: focusSessions.data ?? [],
    achievements: achievements.data ?? [],
    notifications: notifications.data ?? [],
    financial_obligations: financialObligations.data ?? [],
    financial_payments: financialPayments.data ?? [],
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `flow-day-planner-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
