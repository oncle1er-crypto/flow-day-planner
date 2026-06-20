import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { AppHeader } from "./AppHeader";

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
  return (
    <div className="min-h-screen flex flex-col pb-24">
      {!hideHeader && <AppHeader title={title} subtitle={subtitle} action={action} />}
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 pb-8">{children}</main>
      <BottomNav />
    </div>
  );
}