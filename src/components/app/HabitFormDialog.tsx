import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useCreateHabit, useUpdateHabit, useDeleteHabit } from "@/hooks/use-habits";
import type { Habit } from "@/lib/habit-utils";
import { DAY_LABELS } from "@/lib/habit-utils";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const COLORS = ["#A78BFA", "#6366F1", "#10B981", "#F59E0B", "#EF4444", "#3B82F6", "#EC4899", "#14B8A6"];

export function HabitFormDialog({
  open,
  onOpenChange,
  habit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  habit?: Habit;
}) {
  const editing = !!habit;
  const create = useCreateHabit();
  const update = useUpdateHabit();
  const del = useDeleteHabit();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [reminderTime, setReminderTime] = useState("");

  useEffect(() => {
    if (!open) return;
    if (habit) {
      setName(habit.name);
      setDescription(habit.description ?? "");
      setColor(habit.color ?? COLORS[0]);
      setDays(habit.days_of_week);
      setReminderTime(habit.reminder_time?.slice(0, 5) ?? "");
    } else {
      setName("");
      setDescription("");
      setColor(COLORS[0]);
      setDays([0, 1, 2, 3, 4, 5, 6]);
      setReminderTime("");
    }
  }, [open, habit]);

  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

  const save = async () => {
    if (!name.trim() || days.length === 0) return;
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      color,
      days_of_week: days,
      reminder_time: reminderTime || null,
    };
    if (editing && habit) await update.mutateAsync({ id: habit.id, patch: payload });
    else await create.mutateAsync(payload);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">{editing ? "Modifier l'habitude" : "Nouvelle habitude"}</DialogTitle>
          <DialogDescription>Construisez une routine durable.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="hname">Nom</Label>
            <Input id="hname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Méditer 10 min" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hdesc">Description</Label>
            <Textarea id="hdesc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Pourquoi cette habitude ?" />
          </div>
          <div className="space-y-2">
            <Label>Couleur</Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn("h-8 w-8 rounded-full border-2 transition", color === c ? "border-foreground scale-110" : "border-transparent")}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Jours actifs</Label>
            <div className="grid grid-cols-7 gap-1.5">
              {DAY_LABELS.map((lbl, i) => {
                const active = days.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={cn(
                      "h-10 rounded-lg text-sm font-medium transition border",
                      active ? "bg-primary text-primary-foreground border-primary" : "bg-secondary/40 text-muted-foreground border-border",
                    )}
                  >
                    {lbl}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hrem">Rappel (optionnel)</Label>
            <Input id="hrem" type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          {editing && habit && (
            <Button
              variant="ghost"
              size="icon"
              className="mr-auto text-destructive hover:bg-destructive/10"
              onClick={async () => {
                await del.mutateAsync(habit.id);
                onOpenChange(false);
              }}
              aria-label="Supprimer"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={save} disabled={!name.trim() || days.length === 0 || create.isPending || update.isPending}>
            {editing ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
