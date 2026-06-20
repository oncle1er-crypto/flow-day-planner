import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, User, CloudOff } from "lucide-react";
import { useUnreadCount } from "@/hooks/use-notifications";
import { useOnlineStatus, usePendingSyncCount } from "@/hooks/use-online-status";

export function AppHeader({ title, subtitle, action }: { title?: string; subtitle?: string; action?: ReactNode }) {
  const unread = useUnreadCount();
  const online = useOnlineStatus();
  const pending = usePendingSyncCount();
  return (
    <header className="sticky top-0 z-30 glass border-b border-border/40">
      <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          {subtitle && <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{subtitle}</p>}
          {title && <h1 className="font-display text-2xl font-semibold truncate">{title}</h1>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {action}
          {(!online || pending > 0) && (
            <div
              className="flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-500 px-2.5 h-7 text-xs font-medium"
              title={online ? "Synchronisation en attente" : "Hors-ligne — modifications mises en file"}
            >
              <CloudOff className="h-3.5 w-3.5" />
              {pending > 0 ? pending : "Hors-ligne"}
            </div>
          )}
          <Link
            to="/notifications"
            aria-label="Notifications"
            className="relative h-10 w-10 rounded-full grid place-items-center bg-secondary/60 hover:bg-secondary transition"
          >
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
            )}
          </Link>
          <Link
            to="/profile"
            aria-label="Profil"
            className="h-10 w-10 rounded-full grid place-items-center bg-secondary/60 hover:bg-secondary transition"
          >
            <User className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </header>
  );
}