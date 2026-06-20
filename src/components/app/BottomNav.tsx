import { Link } from "@tanstack/react-router";
import { Home, CalendarDays, ListChecks, Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/dashboard", label: "Accueil", icon: Home },
  { to: "/today", label: "Aujourd'hui", icon: ListChecks },
  { to: "/calendar", label: "Agenda", icon: CalendarDays },
  { to: "/assistant", label: "Assistant", icon: Sparkles },
  { to: "/profile", label: "Profil", icon: User },
] as const;

export function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 glass border-t border-border/40"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="max-w-2xl mx-auto grid grid-cols-5 px-2 py-2">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              className="flex flex-col items-center gap-1 py-1.5 rounded-xl text-muted-foreground transition data-[status=active]:text-primary"
              activeProps={{ className: cn("text-primary bg-primary/10") }}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium tracking-wide">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}