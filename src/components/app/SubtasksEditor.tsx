import { useState } from "react";
import { useSubtasks, useCreateSubtask, useToggleSubtask, useDeleteSubtask } from "@/hooks/use-subtasks";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function SubtasksEditor({ taskId }: { taskId: string }) {
  const { data: items = [] } = useSubtasks(taskId);
  const create = useCreateSubtask();
  const toggle = useToggleSubtask();
  const del = useDeleteSubtask();
  const [draft, setDraft] = useState("");

  const add = () => {
    const t = draft.trim();
    if (!t) return;
    create.mutate({ taskId, title: t });
    setDraft("");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Sous-tâches</p>
        {items.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {items.filter((s) => s.is_completed).length}/{items.length}
          </span>
        )}
      </div>
      <div className="space-y-1.5 max-h-44 overflow-auto pr-1">
        {items.map((s) => (
          <div key={s.id} className="flex items-center gap-2 rounded-lg bg-secondary/40 px-2 py-1.5">
            <button
              type="button"
              onClick={() => toggle.mutate({ id: s.id, taskId, completed: !s.is_completed })}
              className={cn(
                "h-5 w-5 shrink-0 rounded-md border-2 grid place-items-center transition",
                s.is_completed ? "bg-success border-success text-success-foreground" : "border-border",
              )}
            >
              {s.is_completed && <Check className="h-3 w-3" strokeWidth={3} />}
            </button>
            <span className={cn("flex-1 text-sm truncate", s.is_completed && "line-through text-muted-foreground")}>
              {s.title}
            </span>
            <button
              type="button"
              onClick={() => del.mutate({ id: s.id, taskId })}
              className="text-muted-foreground hover:text-destructive p-0.5"
              aria-label="Supprimer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Ajouter une sous-tâche"
          className="h-9"
        />
        <Button type="button" size="icon" variant="secondary" onClick={add} disabled={!draft.trim()} className="h-9 w-9 shrink-0">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
