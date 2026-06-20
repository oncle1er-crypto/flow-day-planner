import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { AppHeader } from "./AppHeader";
import { useGamification } from "@/hooks/use-gamification";
import { useScheduledReminders } from "@/hooks/use-push-notifications";

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
  // Background hook: detects newly unlocked achievements on any authenticated page
  useGamification();
  // Schedules local notifications for tasks & daily reminder
  useScheduledReminders();
  return (
    <div className="min-h-screen flex flex-col pb-24">
      {!hideHeader && <AppHeader title={title} subtitle={subtitle} action={action} />}
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 pb-8">{children}</main>
      <BottomNav />
    </div>
  );
}