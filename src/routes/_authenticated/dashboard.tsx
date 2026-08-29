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
import {
  ListChecks,
  AlertTriangle,
  CheckCircle2,
  Flame,
  CalendarDays,
  Sparkles,
  ArrowRight,
  Trophy,
} from "lucide-react";
import { useGamification } from "@/hooks/use-gamification";
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
  const { xp, level } = useGamification();

  const done = todayTasks.filter((t) => t.status === "done").length;
  const total = todayTasks.length;
  const overdue = allTasks.filter((t) => isOverdue(t)).length;
  const urgent = todayTasks.filter((t) => t.priority === "urgent" && t.status !== "done").length;
  const progress = total ? Math.round((done / total) * 100) : 0;
  const upcoming = todayTasks.filter((t) => t.status !== "done").slice(0, 3);
  const quote = QUOTES[new Date().getDate() % QUOTES.length];

  return (
    <AppShell title={greetingForNow(profile?.full_name)} subtitle={fmtDate(new Date())}>
      <div className="space-y-6 pt-4">
        <div className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm opacity-80">Progression du jour</p>
              <p className="text-2xl font-bold">
                {done}/{total} tâches
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold">{progress}%</p>
              <div className="flex items-center gap-1 text-xs opacity-80 mt-1">
                <Trophy className="h-3 w-3" /> Niv. {level.level} · {xp} XP
              </div>
            </div>
          </div>
          <Progress value={progress} className="h-2 bg-primary-foreground/20" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Link
            to="/today"
            className="rounded-xl bg-card p-3 text-center shadow-card hover:shadow-soft transition-shadow"
          >
            <ListChecks className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-xl font-bold">{total}</p>
            <p className="text-[11px] text-muted-foreground">Aujourd'hui</p>
          </Link>
          <Link
            to="/today"
            className="rounded-xl bg-card p-3 text-center shadow-card hover:shadow-soft transition-shadow"
          >
            <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-destructive" />
            <p className="text-xl font-bold">{overdue}</p>
            <p className="text-[11px] text-muted-foreground">En retard</p>
          </Link>
          <Link
            to="/today"
            className="rounded-xl bg-card p-3 text-center shadow-card hover:shadow-soft transition-shadow"
          >
            <Flame className="h-5 w-5 mx-auto mb-1 text-warning" />
            <p className="text-xl font-bold">{urgent}</p>
            <p className="text-[11px] text-muted-foreground">Urgentes</p>
          </Link>
        </div>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" /> À venir
            </h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/today">
                Voir tout <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
          {upcoming.length === 0 ? (
            <div className="rounded-xl bg-card p-6 text-center shadow-card">
              <CheckCircle2 className="h-8 w-8 mx-auto text-success mb-2" />
              <p className="font-medium">Tout est fait !</p>
              <p className="text-sm text-muted-foreground">Profitez de votre temps libre.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.map((task) => (
                <TaskCard key={task.id} task={task} categories={categories} />
              ))}
            </div>
          )}
        </section>

        <div className="rounded-xl bg-accent/50 p-4 flex gap-3 items-start">
          <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <p className="text-sm italic text-muted-foreground">« {quote} »</p>
        </div>
      </div>
      <FloatingActionButton />
    </AppShell>
  );
}
