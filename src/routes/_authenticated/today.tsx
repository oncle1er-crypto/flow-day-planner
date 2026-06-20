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

  const overdue = all.filter(isOverdue);
  const urgent = tasks.filter((t) => t.priority === "urgent" && t.status !== "done");
  const todo = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");

  return (
    <AppShell title="Aujourd'hui" subtitle={fmtDate(new Date())}>
      <div className="space-y-6 pt-4">
        {overdue.length > 0 && (
          <Section title="En retard" icon={AlertTriangle} tone="destructive" count={overdue.length}>
            {overdue.slice(0, 5).map((t) => <TaskCard key={t.id} task={t} categories={categories} />)}
          </Section>
        )}
        {urgent.length > 0 && (
          <Section title="Urgent" icon={Flame} tone="warning" count={urgent.length}>
            {urgent.map((t) => <TaskCard key={t.id} task={t} categories={categories} />)}
          </Section>
        )}
        <Section title="À faire aujourd'hui" icon={ListChecks} tone="primary" count={todo.length}>
          {isLoading ? (
            <Skeleton />
          ) : todo.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="Rien de prévu"
              description="Profitez-en pour planifier votre journée."
              action={<Button onClick={() => setOpen(true)}>Ajouter une tâche</Button>}
            />
          ) : (
            todo.filter((t) => t.priority !== "urgent").map((t) => <TaskCard key={t.id} task={t} categories={categories} />)
          )}
        </Section>
        {done.length > 0 && (
          <Section title="Terminées" icon={CheckCircle2} tone="success" count={done.length}>
            {done.map((t) => <TaskCard key={t.id} task={t} categories={categories} />)}
          </Section>
        )}
      </div>
      <TaskFormDialog open={open} onOpenChange={setOpen} />
      <FloatingActionButton />
    </AppShell>
  );
}

function Section({ title, icon: Icon, tone, count, children }: { title: string; icon: typeof ListChecks; tone: "primary" | "destructive" | "warning" | "success"; count: number; children: React.ReactNode }) {
  const t = { primary: "text-primary", destructive: "text-destructive", warning: "text-warning", success: "text-success" }[tone];
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`h-4 w-4 ${t}`} />
        <h2 className="font-display font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground">· {count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Skeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-20 rounded-2xl bg-card/40 animate-pulse" />
      ))}
    </div>
  );
}