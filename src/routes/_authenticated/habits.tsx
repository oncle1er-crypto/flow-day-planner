import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { useHabits, useHabitLogs, useToggleHabitDay } from "@/hooks/use-habits";
import { computeStreak, isHabitDueOn, last7Days, DAY_LABELS } from "@/lib/habit-utils";
import type { Habit } from "@/lib/habit-utils";
import { EmptyState } from "@/components/app/EmptyState";
import { Sparkles, Flame, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";
import { HabitFormDialog } from "@/components/app/HabitFormDialog";
import { cn } from "@/lib/utils";
import { todayISO } from "@/lib/dates";

export const Route = createFileRoute("/_authenticated/habits")({ component: HabitsPage });

function HabitsPage() {
  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 60);
    return d.toISOString().slice(0, 10);
  }, []);
  const { data: habits = [] } = useHabits();
  const { data: logs = [] } = useHabitLogs(since);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Habit | undefined>(undefined);

  const logsByHabit = useMemo(() => {
    const m = new Map<string, typeof logs>();
    for (const l of logs) {
      const arr = m.get(l.habit_id) ?? [];
      arr.push(l);
      m.set(l.habit_id, arr);
    }
    return m;
  }, [logs]);

  return (
    <AppShell
      title="Habitudes"
      subtitle={habits.length ? `${habits.length} routine${habits.length > 1 ? "s" : ""}` : "Construisez vos routines"}
      action={
        <Button size="sm" onClick={() => { setEditing(undefined); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nouvelle
        </Button>
      }
    >
      <div className="pt-4 space-y-3">
        {habits.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="Aucune habitude"
            description="Ajoutez votre première routine quotidienne."
            action={<Button onClick={() => { setEditing(undefined); setOpen(true); }}>Créer une habitude</Button>}
          />
        ) : (
          habits.map((h) => (
            <HabitRow
              key={h.id}
              habit={h}
              logs={logsByHabit.get(h.id) ?? []}
              onEdit={() => { setEditing(h); setOpen(true); }}
            />
          ))
        )}
      </div>
      <HabitFormDialog open={open} onOpenChange={setOpen} habit={editing} />
    </AppShell>
  );
}

function HabitRow({ habit, logs, onEdit }: { habit: Habit; logs: { log_date: string }[]; onEdit: () => void }) {
  const toggle = useToggleHabitDay();
  const streak = computeStreak(habit, logs as never);
  const week = last7Days();
  const doneSet = new Set(logs.map((l) => l.log_date));
  const todayKey = todayISO();
  const dueToday = isHabitDueOn(habit, new Date());
  const doneToday = doneSet.has(todayKey);

  return (
    <article className="rounded-2xl border border-border bg-gradient-card p-4 shadow-card">
      <div className="flex items-start gap-3">
        <button
          onClick={() => dueToday && toggle.mutate({ habitId: habit.id, date: todayKey, done: !doneToday })}
          disabled={!dueToday}
          className={cn(
            "mt-0.5 h-10 w-10 shrink-0 rounded-2xl grid place-items-center border-2 transition",
            doneToday ? "border-transparent text-primary-foreground" : "border-border",
            !dueToday && "opacity-40",
          )}
          style={doneToday ? { backgroundColor: habit.color ?? undefined, borderColor: habit.color ?? undefined } : undefined}
          aria-label={doneToday ? "Annuler aujourd'hui" : "Valider aujourd'hui"}
        >
          {doneToday ? <Check className="h-5 w-5" strokeWidth={3} /> : <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: habit.color ?? undefined }} />}
        </button>
        <button onClick={onEdit} className="flex-1 text-left min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-medium truncate">{habit.name}</h3>
            {streak > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-400 shrink-0">
                <Flame className="h-3.5 w-3.5" /> {streak}
              </span>
            )}
          </div>
          {habit.description && (
            <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{habit.description}</p>
          )}
          <div className="mt-3 grid grid-cols-7 gap-1.5">
            {week.map((d) => {
              const date = new Date(d + "T00:00:00");
              const due = isHabitDueOn(habit, date);
              const done = doneSet.has(d);
              const isToday = d === todayKey;
              return (
                <div key={d} className="flex flex-col items-center gap-1">
                  <span className={cn("text-[10px]", isToday ? "text-primary font-semibold" : "text-muted-foreground")}>
                    {DAY_LABELS[date.getDay()]}
                  </span>
                  <div
                    className={cn(
                      "h-6 w-6 rounded-md border",
                      !due && "opacity-30 border-dashed",
                      done ? "border-transparent" : "border-border bg-secondary/30",
                    )}
                    style={done ? { backgroundColor: habit.color ?? undefined } : undefined}
                  />
                </div>
              );
            })}
          </div>
        </button>
      </div>
    </article>
  );
}
