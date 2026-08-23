import { useEffect, type ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { AppHeader } from "./AppHeader";
import { useGamification } from "@/hooks/use-gamification";
import { useScheduledReminders } from "@/hooks/use-push-notifications";
import { useOfflineSync } from "@/hooks/use-online-status";
import { useRecurrenceCatchup } from "@/hooks/use-recurrence-catchup";
import { useTimezoneSync } from "@/hooks/use-timezone-sync";
import { installNativeReminderActionHandler } from "@/lib/native-reminders";

export function AppShell({
  children,
  title,
  subtitle,
  action,
  hideHeader,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  hideHeader?: boolean;
}) {
  // Keep server-side reminder scheduling aligned with the device timezone.
  useTimezoneSync();
  // Background hook: detects newly unlocked achievements on any authenticated page
  useGamification();
  // Schedules browser timers or native OS reminders, depending on runtime.
  useScheduledReminders();
  // Offline queue: auto-flush when connection returns
  useOfflineSync();
  // Recurring tasks: make sure due series have their next occurrence
  useRecurrenceCatchup();

  useEffect(() => {
    let cleanup: (() => Promise<void>) | null = null;
    void installNativeReminderActionHandler().then((remove) => {
      cleanup = remove;
    });
    return () => {
      if (cleanup) void cleanup();
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col pb-24">
      {!hideHeader && <AppHeader title={title} subtitle={subtitle} action={action} />}
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 pb-8">{children}</main>
      <BottomNav />
    </div>
  );
}
