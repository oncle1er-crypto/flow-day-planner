import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Permission = "default" | "granted" | "denied" | "unsupported";

function getPermission(): Permission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as Permission;
}

function notify(title: string, options?: NotificationOptions) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { icon: "/favicon.ico", badge: "/favicon.ico", ...options });
  } catch {
    // ignore
  }
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<Permission>(getPermission());

  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return "unsupported" as const;
    const result = await Notification.requestPermission();
    setPermission(result as Permission);
    if (result === "granted") {
      notify("Notifications activées 🔔", { body: "Vous recevrez vos rappels ici." });
    }
    return result;
  }, []);

  return {
    permission,
    isSupported: permission !== "unsupported",
    isGranted: permission === "granted",
    requestPermission,
    notify,
  };
}

/**
 * Schedules local notifications while the app is open:
 *  - Per-task reminders based on due_date + due_time + default_reminder_minutes
 *  - Daily summary reminder at user's chosen time
 */
export function useScheduledReminders() {
  const timersRef = useRef<number[]>([]);

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("user_settings").select("*").eq("user_id", u.user.id).maybeSingle();
      return data;
    },
  });

  const { data: tasks } = useQuery({
    queryKey: ["tasks-for-reminders"],
    queryFn: async () => {
      const todayISO = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("tasks")
        .select("id,title,due_date,due_time,reminder_enabled,status")
        .gte("due_date", todayISO)
        .neq("status", "done")
        .neq("status", "cancelled")
        .eq("is_archived", false);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60_000,
  });

  useEffect(() => {
    // Clear previous timers
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];

    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (!settings?.notifications_enabled) return;

    const now = Date.now();
    const leadMs = (settings.default_reminder_minutes ?? 15) * 60_000;

    // Per-task reminders
    (tasks ?? []).forEach((t) => {
      if (!t.reminder_enabled || !t.due_date) return;
      const time = t.due_time ?? "09:00:00";
      const due = new Date(`${t.due_date}T${time}`).getTime();
      const fireAt = due - leadMs;
      const delay = fireAt - now;
      if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
        const id = window.setTimeout(() => {
          notify("⏰ Rappel : " + t.title, { body: `Prévu à ${time.slice(0, 5)}` });
        }, delay);
        timersRef.current.push(id);
      }
    });

    // Daily summary reminder
    if (settings.daily_reminder_enabled && settings.daily_reminder_time) {
      const [h, m] = String(settings.daily_reminder_time).split(":").map(Number);
      const next = new Date();
      next.setHours(h, m ?? 0, 0, 0);
      if (next.getTime() <= now) next.setDate(next.getDate() + 1);
      const delay = next.getTime() - now;
      if (delay < 24 * 60 * 60 * 1000) {
        const id = window.setTimeout(() => {
          notify("🌅 Bonjour !", { body: "Voici votre plan du jour. Allez-y, c'est parti !" });
        }, delay);
        timersRef.current.push(id);
      }
    }

    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    };
  }, [settings, tasks]);
}