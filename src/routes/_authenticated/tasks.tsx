import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { FloatingActionButton } from "@/components/app/FloatingActionButton";
import { useTasks } from "@/hooks/use-tasks";
import { useCategories } from "@/hooks/use-categories";
import { TaskCard } from "@/components/app/TaskCard";
import { EmptyState } from "@/components/app/EmptyState";
import { Input } from "@/components/ui/input";
import { Search, ListChecks } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Status } from "@/lib/task-utils";

export const Route = createFileRoute("/_authenticated/tasks")({ component: TasksPage });

function TasksPage() {
  const [filter, setFilter] = useState<"all" | "open" | "done">("all");
  const [q, setQ] = useState("");
  const status: Status[] | undefined = filter === "open" ? ["todo", "in_progress"] : filter === "done" ? ["done"] : undefined;
  const { data: tasks = [], isLoading } = useTasks({ status });
  const { data: categories = [] } = useCategories();

  const filtered = q
    ? tasks.filter((t) =>
        [t.title, t.description ?? "", ...(t.tags ?? [])].some((s) => s.toLowerCase().includes(q.toLowerCase())),
      )
    : tasks;

  return (
    <AppShell title="Toutes les tâches" subtitle="Bibliothèque">
      <div className="space-y-4 pt-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une tâche…" className="pl-9 h-11" />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">Toutes</TabsTrigger>
            <TabsTrigger value="open" className="flex-1">En cours</TabsTrigger>
            <TabsTrigger value="done" className="flex-1">Terminées</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="space-y-2">
          {isLoading ? (
            [1, 2, 3, 4].map((i) => <div key={i} className="h-20 rounded-2xl bg-card/40 animate-pulse" />)
          ) : filtered.length === 0 ? (
            <EmptyState icon={ListChecks} title="Aucune tâche" description="Créez votre première tâche avec le bouton +" />
          ) : (
            filtered.map((t) => <TaskCard key={t.id} task={t} categories={categories} />)
          )}
        </div>
      </div>
      <FloatingActionButton />
    </AppShell>
  );
}