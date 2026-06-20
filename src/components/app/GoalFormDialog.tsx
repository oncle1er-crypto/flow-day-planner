import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useCreateGoal, useUpdateGoal, useDeleteGoal } from "@/hooks/use-goals";
import type { Goal, GoalStatus, GoalType } from "@/lib/goal-utils";
import { GOAL_STATUS_LABEL, GOAL_TYPE_LABEL } from "@/lib/goal-utils";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function GoalFormDialog({
  open,
  onOpenChange,
  goal,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  goal?: Goal;
}) {
  const editing = !!goal;
  const create = useCreateGoal();
  const update = useUpdateGoal();
  const del = useDeleteGoal();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<GoalType>("short");
  const [status, setStatus] = useState<GoalStatus>("active");
  const [progress, setProgress] = useState(0);
  const [targetDate, setTargetDate] = useState("");

  useEffect(() => {
    if (!open) return;
    if (goal) {
      setTitle(goal.title);
      setDescription(goal.description ?? "");
      setType(goal.type);
      setStatus(goal.status);
      setProgress(goal.progress);
      setTargetDate(goal.target_date ?? "");
    } else {
      setTitle("");
      setDescription("");
      setType("short");
      setStatus("active");
      setProgress(0);
      setTargetDate("");
    }
  }, [open, goal]);

  const save = async () => {
    if (!title.trim()) return;
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      type,
      status,
      progress,
      target_date: targetDate || null,
    };
    if (editing && goal) await update.mutateAsync({ id: goal.id, patch: payload });
    else await create.mutateAsync(payload);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">{editing ? "Modifier l'objectif" : "Nouvel objectif"}</DialogTitle>
          <DialogDescription>Donnez une direction claire à votre énergie.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="gtitle">Titre</Label>
            <Input id="gtitle" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex : Courir un semi-marathon" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gdesc">Description</Label>
            <Textarea id="gdesc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Pourquoi cet objectif compte ?" />
          </div>
          <div className="space-y-2">
            <Label>Horizon</Label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(GOAL_TYPE_LABEL) as GoalType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    "rounded-lg border p-2.5 text-sm font-medium transition",
                    type === t ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/40 text-muted-foreground",
                  )}
                >
                  {GOAL_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Statut</Label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(GOAL_STATUS_LABEL) as GoalStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={cn(
                    "rounded-lg border p-2 text-xs font-medium transition",
                    status === s ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/40 text-muted-foreground",
                  )}
                >
                  {GOAL_STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Progression</Label>
              <span className="text-sm font-semibold tabular-nums">{progress}%</span>
            </div>
            <Slider value={[progress]} onValueChange={(v) => setProgress(v[0])} min={0} max={100} step={5} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gdate">Échéance (optionnel)</Label>
            <Input id="gdate" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          {editing && goal && (
            <Button
              variant="ghost"
              size="icon"
              className="mr-auto text-destructive hover:bg-destructive/10"
              onClick={async () => {
                await del.mutateAsync(goal.id);
                onOpenChange(false);
              }}
              aria-label="Supprimer"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={save} disabled={!title.trim() || create.isPending || update.isPending}>
            {editing ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
