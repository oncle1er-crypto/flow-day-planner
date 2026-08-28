import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { FloatingActionButton } from "@/components/app/FloatingActionButton";
import { useTasks } from "@/hooks/use-tasks";
import { useCategories } from "@/hooks/use-categories";
import { TaskCard } from "@/components/app/TaskCard";
import { EmptyState } from "@/components/app/EmptyState";
import { fmtDate, todayISO } from "@/lib/dates";
import { isOverdue } from "@/lib/task-utils";
import { ListChecks, AlertTriangle, CheckCircle2, Flame } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TaskFormDialog } from "@/components/app/TaskFormDialog";

export const Route = createFileRoute("/_authenticated/today")({ component: TodayPage });

function TodayPage() {
  const today = todayISO();
  const { data: tasks = [], isLoading } = useTasks({ dueOn: today });
  const { data: all = [] } = useTasks();
  const { data: categories = [] } = useCategories();
  const [open, setOpen] = useState(false);

  const overdue = all.filter((t) => isOverdue(t));
  const urgent = tasks.filter((t) => t.priority === "urgent" && t.status !== "done");
  const todo = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");

  return (
    <AppShell title="Aujourd'hui" subtitle={fmtDate(new Date())}>
      <div className="space-y-6 pt-4">
        {overdue.length > 0 && (
          <Section title="En retard" icon={AlertTriangle} tone="destructive" count={overdue.length}>
            {overdue.slice(0, 5).map((t) => (
              <TaskCard key={t.id} task={t} categories={categories} />
            ))}
          </Section>
        )}
        {urgent.length > 0 && (
          <Section title="Urgent" icon={Flame} tone="warning" count={urgent.length}>
            {urgent.map((t) => <TaskCard key={t.id} task={t} categories={categories} />)}
          </Section>
        )}
        <Section title="À faire" icon={ListChecks} count={todo.length}>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : todo.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Tout est fait !" description="Aucune tâche à faire aujourd'hui." />
          ) : (
            todo.map((t) => <TaskCard key={t.id} task={t} categories={categories} />)
          )}
        </Section>
        {done.length > 0 && (
          <Section title="Terminées" icon={CheckCircle2} count={done.length}>
            {done.map((t) => <TaskCard key={t.id} task={t} categories={categories} />)}
          </Section>
        )}
      </div>
      <FloatingActionButton onClick={() => setOpen(true)} />
      <TaskFormDialog open={open} onOpenChange={setOpen} />
    </AppShell>
  );
}

function Section({ title, icon: Icon, count, children, tone }: { title: string; icon: React.ElementType; count: number; children: React.ReactNode; tone?: string }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`h-5 w-5 ${tone === "destructive" ? "text-destructive" : tone === "warning" ? "text-warning" : "text-primary"}`} />
        <h2 className="font-semibold text-lg">{title}</h2>
        <span className="text-xs bg-muted rounded-full px-2 py-0.5 text-muted-foreground">{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
