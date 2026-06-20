import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { useGoals, useUpdateGoal } from "@/hooks/use-goals";
import type { Goal } from "@/lib/goal-utils";
import { GOAL_STATUS_LABEL, daysUntil } from "@/lib/goal-utils";
import { EmptyState } from "@/components/app/EmptyState";
import { Target, Plus, CalendarClock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useMemo, useState } from "react";
import { GoalFormDialog } from "@/components/app/GoalFormDialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/goals")({ component: GoalsPage });

function GoalsPage() {
  const { data: goals = [] } = useGoals();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | undefined>(undefined);

  const groups = useMemo(() => {
    const short = goals.filter((g) => g.type === "short");
    const long = goals.filter((g) => g.type === "long");
    return { short, long };
  }, [goals]);

  const openNew = () => { setEditing(undefined); setOpen(true); };
  const openEdit = (g: Goal) => { setEditing(g); setOpen(true); };

  return (
    <AppShell
      title="Objectifs"
      subtitle={goals.length ? `${goals.length} en vue` : "Définissez votre cap"}
      action={
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Nouvel
        </Button>
      }
    >
      <div className="pt-4 space-y-6">
        {goals.length === 0 ? (
          <EmptyState
            icon={Target}
            title="Aucun objectif"
            description="Fixez un cap court ou long terme pour orienter vos actions."
            action={<Button onClick={openNew}>Créer un objectif</Button>}
          />
        ) : (
          <>
            <Section title="Court terme" items={groups.short} onEdit={openEdit} />
            <Section title="Long terme" items={groups.long} onEdit={openEdit} />
          </>
        )}
      </div>
      <GoalFormDialog open={open} onOpenChange={setOpen} goal={editing} />
    </AppShell>
  );
}

function Section({ title, items, onEdit }: { title: string; items: Goal[]; onEdit: (g: Goal) => void }) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="space-y-2.5">
        {items.map((g) => <GoalCard key={g.id} goal={g} onEdit={() => onEdit(g)} />)}
      </div>
    </section>
  );
}

function GoalCard({ goal, onEdit }: { goal: Goal; onEdit: () => void }) {
  const update = useUpdateGoal();
  const days = daysUntil(goal.target_date);
  const isDone = goal.status === "done" || goal.progress >= 100;

  return (
    <article className="rounded-2xl border border-border bg-gradient-card p-4 shadow-card">
      <div className="flex items-start gap-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            const nextDone = !isDone;
            update.mutate({
              id: goal.id,
              patch: { status: nextDone ? "done" : "active", progress: nextDone ? 100 : Math.min(goal.progress, 95) },
            });
          }}
          className={cn(
            "mt-0.5 h-9 w-9 shrink-0 rounded-full grid place-items-center border-2 transition",
            isDone ? "bg-primary border-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary/60",
          )}
          aria-label={isDone ? "Marquer en cours" : "Marquer atteint"}
        >
          <CheckCircle2 className="h-5 w-5" />
        </button>
        <button onClick={onEdit} className="flex-1 text-left min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className={cn("font-medium truncate", isDone && "line-through text-muted-foreground")}>{goal.title}</h3>
            <span className="text-xs text-muted-foreground shrink-0">{GOAL_STATUS_LABEL[goal.status]}</span>
          </div>
          {goal.description && (
            <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{goal.description}</p>
          )}
          <div className="mt-3 flex items-center gap-3">
            <Progress value={goal.progress} className="h-1.5 flex-1" />
            <span className="text-xs font-semibold tabular-nums text-muted-foreground w-9 text-right">{goal.progress}%</span>
          </div>
          {days !== null && (
            <div className={cn(
              "mt-2 inline-flex items-center gap-1 text-xs",
              days < 0 ? "text-destructive" : days <= 7 ? "text-orange-400" : "text-muted-foreground",
            )}>
              <CalendarClock className="h-3.5 w-3.5" />
              {days < 0 ? `En retard de ${-days} j` : days === 0 ? "Aujourd'hui" : `Dans ${days} j`}
            </div>
          )}
        </button>
      </div>
    </article>
  );
}
