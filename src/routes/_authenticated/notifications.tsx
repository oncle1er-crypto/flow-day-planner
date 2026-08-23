import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { useNotifications, useMarkRead, useMarkAllRead } from "@/hooks/use-notifications";
import { EmptyState } from "@/components/app/EmptyState";
import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtRelative } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/notifications")({ component: NotifPage });

function NotifPage() {
  const { data: items = [], isLoading, isError, error, refetch } = useNotifications();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const unread = items.filter((n) => !n.is_read).length;

  return (
    <AppShell
      title="Notifications"
      subtitle={unread ? `${unread} non lue${unread > 1 ? "s" : ""}` : "Tout est lu"}
      action={
        unread > 0 && (
          <Button size="sm" variant="ghost" onClick={() => markAll.mutate()}>
            <Check className="h-4 w-4 mr-1" /> Tout lire
          </Button>
        )
      }
    >
      <div className="pt-4 space-y-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card/60 p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-9 w-9 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            </div>
          ))
        ) : isError ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-center space-y-3">
            <p className="text-sm text-destructive" role="alert">
              {error instanceof Error ? error.message : "Impossible de charger les notifications."}
            </p>
            <Button size="sm" variant="ghost" onClick={() => refetch()}>Réessayer</Button>
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={Bell} title="Aucune notification" description="Vos rappels apparaîtront ici." />
        ) : (
          items.map((n) => (
            <button
              key={n.id}
              onClick={() => !n.is_read && markRead.mutate(n.id)}
              className={cn(
                "w-full text-left rounded-2xl border border-border bg-card/60 p-4 transition",
                !n.is_read && "border-primary/40 bg-primary/5",
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn("h-9 w-9 rounded-xl grid place-items-center shrink-0", n.is_read ? "bg-secondary" : "bg-primary/15")}>
                  <Bell className={cn("h-4 w-4", n.is_read ? "text-muted-foreground" : "text-primary")} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{n.title}</p>
                  {n.body && <p className="text-sm text-muted-foreground line-clamp-2">{n.body}</p>}
                  <p className="text-xs text-muted-foreground mt-1">{fmtRelative(n.created_at)}</p>
                </div>
                {!n.is_read && <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />}
              </div>
            </button>
          ))
        )}
      </div>
    </AppShell>
  );
}