import type { Database } from "@/integrations/supabase/types";

export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];
export type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type Subtask = Database["public"]["Tables"]["subtasks"]["Row"];
export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

export type Priority = "low" | "normal" | "high" | "urgent";
export type Status = "todo" | "in_progress" | "done" | "cancelled" | "postponed";

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Basse",
  normal: "Normale",
  high: "Haute",
  urgent: "Urgente",
};

export const STATUS_LABEL: Record<Status, string> = {
  todo: "À faire",
  in_progress: "En cours",
  done: "Terminée",
  cancelled: "Annulée",
  postponed: "Reportée",
};

export const PRIORITY_COLOR: Record<Priority, string> = {
  low: "bg-priority-low/15 text-priority-low border-priority-low/30",
  normal: "bg-priority-normal/15 text-priority-normal border-priority-normal/30",
  high: "bg-priority-high/15 text-priority-high border-priority-high/30",
  urgent: "bg-priority-urgent/15 text-priority-urgent border-priority-urgent/30",
};

export function isOverdue(t: Pick<Task, "due_date" | "status">) {
  if (!t.due_date || t.status === "done" || t.status === "cancelled") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(t.due_date) < today;
}