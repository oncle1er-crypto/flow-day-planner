import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { useProfile } from "@/hooks/use-profile";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Settings, LogOut, ListChecks, Bell, User, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({ component: ProfilePage });

function ProfilePage() {
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const handleSignOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Déconnecté");
    navigate({ to: "/auth", replace: true });
  };

  const initials = (profile?.full_name ?? profile?.email ?? "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <AppShell title="Profil" subtitle="Votre compte">
      <div className="pt-4 space-y-6">
        <div className="rounded-3xl bg-gradient-card border border-border p-6 shadow-card text-center">
          <div className="mx-auto h-20 w-20 rounded-full bg-gradient-primary shadow-glow grid place-items-center text-2xl font-display font-bold text-primary-foreground">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <h2 className="font-display text-xl font-semibold mt-3">{profile?.full_name ?? "Sans nom"}</h2>
          <p className="text-sm text-muted-foreground">{profile?.email}</p>
        </div>

        <nav className="space-y-2">
          <Row to="/tasks" icon={ListChecks} label="Toutes les tâches" />
          <Row to="/notifications" icon={Bell} label="Notifications" />
          <Row to="/settings" icon={Settings} label="Paramètres" />
          <Row to="/settings" icon={User} label="Modifier le profil" />
        </nav>

        <Button variant="outline" className="w-full h-11 text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive" onClick={handleSignOut}>
          <LogOut className="h-4 w-4 mr-2" /> Se déconnecter
        </Button>
      </div>
    </AppShell>
  );
}

function Row({ to, icon: Icon, label }: { to: "/tasks" | "/notifications" | "/settings"; icon: typeof Settings; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-4 hover:bg-card transition">
      <div className="h-9 w-9 rounded-xl bg-primary/10 grid place-items-center">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <span className="flex-1 font-medium">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}