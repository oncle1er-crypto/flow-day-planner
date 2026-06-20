import { Check, Clock, Repeat, Bell, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { PriorityBadge } from "./PriorityBadge";
import type { Task, Category } from "@/lib/task-utils";
import { isOverdue, type Priority } from "@/lib/task-utils";
import { smartDateLabel } from "@/lib/dates";
import { useToggleTask } from "@/hooks/use-tasks";
import { useState } from "react";
import { TaskFormDialog } from "./TaskFormDialog";
import { useSubtasks } from "@/hooks/use-subtasks";

export function TaskCard({ task, categories }: { task: Task; categories?: Category[] }) {
  const toggle = useToggleTask();
  const [edit, setEdit] = useState(false);
  const done = task.status === "done";
  const overdue = isOverdue(task);
  const cat = categories?.find((c) => c.id === task.category_id);
  const { data: subs = [] } = useSubtasks(task.id);
  const subDone = subs.filter((s) => s.is_done).length;

  return (
    <>
      <article
        className={cn(
          "group relative flex items-start gap-3 rounded-2xl border bg-gradient-card p-4 shadow-card transition hover:border-primary/30",
          done && "opacity-60",
        )}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggle.mutate({ id: task.id, done: !done });
          }}
          aria-label={done ? "Marquer non terminée" : "Marquer terminée"}
          className={cn(
            "mt-0.5 h-6 w-6 shrink-0 rounded-full border-2 grid place-items-center transition",
            done ? "bg-success border-success text-success-foreground" : "border-border hover:border-primary",
          )}
        >
          {done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        </button>

        <button onClick={() => setEdit(true)} className="flex-1 text-left min-w-0">
          <h3 className={cn("font-medium leading-snug truncate", done && "line-through")}>{task.title}</h3>
          {task.description && (
            <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{task.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2 text-xs text-muted-foreground">
            {task.due_date && (
              <span className={cn("inline-flex items-center gap-1", overdue && "text-destructive font-medium")}>
                <Clock className="h-3.5 w-3.5" />
                {smartDateLabel(task.due_date)}
                {task.due_time && ` · ${task.due_time.slice(0, 5)}`}
              </span>
            )}
            {task.reminder_enabled && (
              <span className="inline-flex items-center gap-1"><Bell className="h-3.5 w-3.5" />Rappel</span>
            )}
            {task.recurrence !== "none" && (
              <span className="inline-flex items-center gap-1"><Repeat className="h-3.5 w-3.5" />Récurrent</span>
            )}
            {cat && (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.color }} />
                {cat.name}
              </span>
            )}
            {subs.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <ListChecks className="h-3.5 w-3.5" />
                {subDone}/{subs.length}
              </span>
            )}
            <PriorityBadge priority={task.priority as Priority} />
          </div>
        </button>
      </article>
      <TaskFormDialog open={edit} onOpenChange={setEdit} task={task} />
    </>
  );
}