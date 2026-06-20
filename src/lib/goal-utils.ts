import type { Database } from "@/integrations/supabase/types";

export type Goal = Database["public"]["Tables"]["goals"]["Row"];
export type GoalInsert = Database["public"]["Tables"]["goals"]["Insert"];
export type GoalType = Database["public"]["Enums"]["goal_type"];
export type GoalStatus = Database["public"]["Enums"]["goal_status"];

export const GOAL_TYPE_LABEL: Record<GoalType, string> = {
  short: "Court terme",
  long: "Long terme",
};

export const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  active: "En cours",
  done: "Atteint",
  paused: "En pause",
};

export function daysUntil(dateISO: string | null): number | null {
  if (!dateISO) return null;
  const target = new Date(dateISO + "T00:00:00").getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today.getTime()) / 86_400_000);
}
