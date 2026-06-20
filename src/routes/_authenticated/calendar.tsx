import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { FloatingActionButton } from "@/components/app/FloatingActionButton";
import { useTasks } from "@/hooks/use-tasks";
import { useCategories } from "@/hooks/use-categories";
import { TaskCard } from "@/components/app/TaskCard";
import { EmptyState } from "@/components/app/EmptyState";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { format, addDays, startOfWeek, isSameDay, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { TaskFormDialog } from "@/components/app/TaskFormDialog";

export const Route = createFileRoute("/_authenticated/calendar")({ component: CalendarPage });

function CalendarPage() {
  const [anchor, setAnchor] = useState(new Date());
  const [selected, setSelected] = useState(new Date());
  const [open, setOpen] = useState(false);

  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const selectedISO = format(selected, "yyyy-MM-dd");
  const rangeStart = format(weekStart, "yyyy-MM-dd");
  const rangeEnd = format(addDays(weekStart, 6), "yyyy-MM-dd");

  const { data: weekTasks = [] } = useTasks({ range: [rangeStart, rangeEnd] });
  const { data: dayTasks = [] } = useTasks({ dueOn: selectedISO });
  const { data: categories = [] } = useCategories();

  return (
    <AppShell title={format(anchor, "MMMM yyyy", { locale: fr })} subtitle="Agenda">
      <div className="space-y-5 pt-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => setAnchor(addDays(anchor, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setAnchor(new Date()); setSelected(new Date()); }}>
            Aujourd'hui
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setAnchor(addDays(anchor, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {days.map((d) => {
            const iso = format(d, "yyyy-MM-dd");
            const isSel = isSameDay(d, selected);
            const isToday = isSameDay(d, new Date());
            const count = weekTasks.filter((t) => t.due_date === iso).length;
            return (
              <button
                key={iso}
                onClick={() => setSelected(d)}
                className={`relative aspect-square rounded-xl text-center transition flex flex-col items-center justify-center ${
                  isSel ? "bg-gradient-primary text-primary-foreground shadow-glow" : isToday ? "bg-secondary border border-primary/40" : "bg-card/40 hover:bg-card"
                }`}
              >
                <span className="text-[10px] uppercase opacity-70">{format(d, "EEE", { locale: fr })}</span>
                <span className="font-display text-lg font-semibold">{format(d, "d")}</span>
                {count > 0 && !isSel && (
                  <span className="absolute bottom-1 h-1 w-1 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-semibold">{format(selected, "EEEE d MMMM", { locale: fr })}</h2>
            <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Ajouter
            </Button>
          </div>
          <div className="space-y-2">
            {dayTasks.length === 0 ? (
              <EmptyState icon={CalendarDays} title="Aucune tâche ce jour" />
            ) : (
              dayTasks.map((t) => <TaskCard key={t.id} task={t} categories={categories} />)
            )}
          </div>
        </div>
      </div>
      <TaskFormDialog open={open} onOpenChange={setOpen} defaultDate={selectedISO} />
      <FloatingActionButton />
    </AppShell>
  );
}
// fix unused import
void parseISO;