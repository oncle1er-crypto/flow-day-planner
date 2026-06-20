import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { FloatingActionButton } from "@/components/app/FloatingActionButton";
import { useTasks } from "@/hooks/use-tasks";
import { useProfile } from "@/hooks/use-profile";
import { greetingForNow, fmtDate, todayISO } from "@/lib/dates";
import { isOverdue } from "@/lib/task-utils";
import { Progress } from "@/components/ui/progress";
import { TaskCard } from "@/components/app/TaskCard";
import { useCategories } from "@/hooks/use-categories";
import { ListChecks, AlertTriangle, CheckCircle2, Flame, CalendarDays, Sparkles, ArrowRight, Trophy } from "lucide-react";
import { useGamification } from "@/hooks/use-gamification";
import { useState } from "react";
import { TaskFormDialog } from "@/components/app/TaskFormDialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

const QUOTES = [
  "Une petite action chaque jour vaut mieux qu'un grand projet remis à demain.",
  "Le succès, c'est la somme de petits efforts répétés jour après jour.",
  "Bien commencer, c'est déjà à moitié finir.",
  "Concentrez-vous sur l'essentiel, le reste suivra.",
];

function Dashboard() {
  const { data: profile } = useProfile();
  const today = todayISO();
  const { data: todayTasks = [] } = useTasks({ dueOn: today });
  const { data: allTasks = [] } = useTasks();
  const { data: categories = [] } = useCategories();
  const [openNew, setOpenNew] = useState(false);
  const { xp, level } = useGamification();

  const done = todayTasks.filter((t) => t.status === "done").length;
  const total = todayTasks.length;
  const overdue = allTasks.filter(isOverdue).length;
  const urgent = todayTasks.filter((t) => t.priority === "urgent" && t.status !== "done").length;
  const progress = total ? Math.round((done / total) * 100) : 0;
  const upcoming = todayTasks.filter((t) => t.status !== "done").slice(0, 3);
  const quote = QUOTES[new Date().getDate() % QUOTES.length];

  return (
    <AppShell title={greetingForNow(profile?.full_name)} subtitle={fmtDate(new Date())}>
      <div className="space-y-6 pt-4">
        {/* Progress card */}
        <section className="rounded-3xl bg-gradient-card border border-border p-6 shadow-card relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
          <div className="relative">
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <p className="text-sm text-muted-foreground">Progression du jour</p>
                <p className="font-display text-4xl font-bold mt-1">{progress}<span className="text-2xl text-muted-foreground">%</span></p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Terminées</p>
                <p className="font-display text-2xl font-semibold">{done}<span className="text-muted-foreground text-base">/{total}</span></p>
              </div>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </section>

        {/* Stats grid */}
        <section className="grid grid-cols-2 gap-3">
          <StatTile icon={ListChecks} label="Aujourd'hui" value={total} tint="primary" />
          <StatTile icon={Flame} label="Urgentes" value={urgent} tint="warning" />
          <StatTile icon={AlertTriangle} label="En retard" value={overdue} tint="destructive" />
          <StatTile icon={CheckCircle2} label="Terminées" value={done} tint="success" />
        </section>

        {/* Quick actions */}
        <section className="grid grid-cols-3 gap-3">
          <QuickAction icon={ListChecks} label="Tâche" onClick={() => setOpenNew(true)} />
          <Link to="/calendar" className="contents"><QuickAction icon={CalendarDays} label="Agenda" /></Link>
          <Link to="/assistant" className="contents"><QuickAction icon={Sparkles} label="Planifier" /></Link>
        </section>

        {/* Level card */}
        <Link
          to="/achievements"
          className="block rounded-2xl border border-border bg-card/60 p-4 shadow-card hover:bg-card transition"
        >
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-primary shadow-glow grid place-items-center text-primary-foreground">
              <Trophy className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-display font-semibold">Niveau {level.level}</p>
                <p className="text-xs text-muted-foreground">{xp} XP</p>
              </div>
              <div className="mt-2">
                <Progress value={level.progressPct} className="h-1.5" />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">{level.xpInLevel}/{level.xpForNext} XP → niveau {level.level + 1}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </Link>

        {/* Upcoming */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-semibold text-lg">À traiter maintenant</h2>
            <Link to="/today" className="text-sm text-primary inline-flex items-center gap-1">
              Voir tout <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="space-y-2">
            {upcoming.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card/40 p-6 text-center">
                <p className="text-sm text-muted-foreground">Vous êtes à jour. Bravo !</p>
                <Button variant="link" onClick={() => setOpenNew(true)}>Ajouter une tâche</Button>
              </div>
            ) : (
              upcoming.map((t) => <TaskCard key={t.id} task={t} categories={categories} />)
            )}
          </div>
        </section>

        {/* Quote */}
        <section className="rounded-2xl border border-border bg-card/60 p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Citation du jour</p>
          <p className="font-display text-base leading-relaxed">"{quote}"</p>
        </section>
      </div>

      <TaskFormDialog open={openNew} onOpenChange={setOpenNew} />
      <FloatingActionButton />
    </AppShell>
  );
}

function StatTile({ icon: Icon, label, value, tint }: { icon: typeof ListChecks; label: string; value: number; tint: "primary" | "warning" | "destructive" | "success" }) {
  const tintClass = {
    primary: "text-primary bg-primary/10",
    warning: "text-warning bg-warning/10",
    destructive: "text-destructive bg-destructive/10",
    success: "text-success bg-success/10",
  }[tint];
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4 shadow-card">
      <div className={`h-9 w-9 rounded-xl grid place-items-center ${tintClass} mb-3`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="font-display text-2xl font-bold leading-none">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick }: { icon: typeof ListChecks; label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl border border-border bg-card/40 p-4 text-center hover:border-primary/40 hover:bg-card/80 transition active:scale-95"
    >
      <Icon className="h-5 w-5 text-primary mx-auto mb-1.5" />
      <p className="text-xs font-medium">{label}</p>
    </button>
  );
}