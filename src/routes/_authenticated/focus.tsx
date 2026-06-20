import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Timer, Coffee, CheckCircle2 } from "lucide-react";
import { useTasks } from "@/hooks/use-tasks";
import { useCreateFocusSession, useFocusSessions, type FocusKind } from "@/hooks/use-focus-sessions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/focus")({ component: FocusPage });

const PRESETS: Record<FocusKind, { label: string; minutes: number; icon: typeof Timer }> = {
  focus: { label: "Focus", minutes: 25, icon: Timer },
  short_break: { label: "Pause courte", minutes: 5, icon: Coffee },
  long_break: { label: "Pause longue", minutes: 15, icon: Coffee },
};

function fmt(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const r = (s % 60).toString().padStart(2, "0");
  return `${m}:${r}`;
}

function FocusPage() {
  const [kind, setKind] = useState<FocusKind>("focus");
  const [minutes, setMinutes] = useState<number>(25);
  const [taskId, setTaskId] = useState<string>("none");
  const [remaining, setRemaining] = useState<number>(25 * 60);
  const [running, setRunning] = useState(false);
  const startedAtRef = useRef<Date | null>(null);
  const elapsedRef = useRef(0);

  const { data: tasks = [] } = useTasks({ status: ["todo", "in_progress"] });
  const { data: sessions = [] } = useFocusSessions(10);
  const createSession = useCreateFocusSession();

  // Reset timer when kind changes
  useEffect(() => {
    const m = PRESETS[kind].minutes;
    setMinutes(m);
    setRemaining(m * 60);
    setRunning(false);
    elapsedRef.current = 0;
    startedAtRef.current = null;
  }, [kind]);

  // Tick
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setRemaining((r) => {
        elapsedRef.current += 1;
        if (r <= 1) {
          window.clearInterval(id);
          finish(true);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  function start() {
    if (!startedAtRef.current) startedAtRef.current = new Date();
    setRunning(true);
  }
  function pause() {
    setRunning(false);
  }
  function reset() {
    setRunning(false);
    setRemaining(minutes * 60);
    elapsedRef.current = 0;
    startedAtRef.current = null;
  }
  function applyMinutes(m: number) {
    if (running) return;
    const v = Math.max(1, Math.min(180, Math.floor(m) || 1));
    setMinutes(v);
    setRemaining(v * 60);
  }
  async function finish(completed: boolean) {
    setRunning(false);
    const elapsed = elapsedRef.current;
    if (elapsed < 5) {
      reset();
      return;
    }
    try {
      await createSession.mutateAsync({
        kind,
        planned_minutes: minutes,
        actual_seconds: elapsed,
        started_at: (startedAtRef.current ?? new Date()).toISOString(),
        ended_at: new Date().toISOString(),
        completed,
        task_id: taskId === "none" ? null : taskId,
      });
      toast.success(completed ? "Session terminée 🎉" : "Session enregistrée");
    } finally {
      reset();
    }
  }

  const total = minutes * 60;
  const progress = total > 0 ? 1 - remaining / total : 0;
  const Icon = PRESETS[kind].icon;

  const todayStats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todays = sessions.filter((s) => s.started_at.slice(0, 10) === today && s.kind === "focus");
    const totalSec = todays.reduce((a, s) => a + s.actual_seconds, 0);
    return { count: todays.length, minutes: Math.round(totalSec / 60) };
  }, [sessions]);

  return (
    <AppShell title="Focus" subtitle="Pomodoro & sessions concentrées">
      <div className="mt-2 space-y-6">
        {/* Mode selector */}
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(PRESETS) as FocusKind[]).map((k) => {
            const P = PRESETS[k];
            const active = kind === k;
            return (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={cn(
                  "rounded-xl border px-3 py-2 text-xs font-medium transition",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border/60 hover:text-foreground",
                )}
              >
                {P.label}
              </button>
            );
          })}
        </div>

        {/* Timer ring */}
        <div className="relative mx-auto aspect-square w-64 max-w-full rounded-full bg-card border border-border/60 flex items-center justify-center overflow-hidden">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(hsl(var(--primary)) ${progress * 360}deg, transparent 0deg)`,
              mask: "radial-gradient(circle, transparent 58%, black 60%)",
              WebkitMask: "radial-gradient(circle, transparent 58%, black 60%)",
            }}
          />
          <div className="relative z-10 flex flex-col items-center gap-1">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <div className="text-5xl font-bold tabular-nums tracking-tight">{fmt(remaining)}</div>
            <div className="text-xs text-muted-foreground">{PRESETS[kind].label}</div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          {!running ? (
            <Button onClick={start} size="lg" className="rounded-full px-8 gap-2">
              <Play className="h-4 w-4" /> Démarrer
            </Button>
          ) : (
            <Button onClick={pause} size="lg" variant="secondary" className="rounded-full px-8 gap-2">
              <Pause className="h-4 w-4" /> Pause
            </Button>
          )}
          <Button onClick={reset} size="lg" variant="outline" className="rounded-full gap-2">
            <RotateCcw className="h-4 w-4" />
          </Button>
          {elapsedRef.current >= 5 && (
            <Button onClick={() => finish(false)} size="lg" variant="ghost" className="rounded-full gap-2">
              <CheckCircle2 className="h-4 w-4" /> Stop
            </Button>
          )}
        </div>

        {/* Settings */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Durée (min)</label>
            <Input
              type="number"
              min={1}
              max={180}
              value={minutes}
              disabled={running}
              onChange={(e) => applyMinutes(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Tâche liée</label>
            <Select value={taskId} onValueChange={setTaskId} disabled={running}>
              <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucune</SelectItem>
                {tasks.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Today stats */}
        <div className="rounded-xl border border-border/60 bg-card p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Aujourd'hui</div>
            <div className="text-lg font-semibold">{todayStats.count} session{todayStats.count > 1 ? "s" : ""}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Temps focus</div>
            <div className="text-lg font-semibold tabular-nums">{todayStats.minutes} min</div>
          </div>
        </div>

        {/* History */}
        {sessions.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">Historique récent</h2>
            <ul className="space-y-2">
              {sessions.map((s) => (
                <li key={s.id} className="rounded-lg border border-border/60 bg-card px-3 py-2 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "h-2 w-2 rounded-full",
                      s.kind === "focus" ? "bg-primary" : "bg-muted-foreground/50"
                    )} />
                    <span className="font-medium">{PRESETS[s.kind].label}</span>
                    <span className="text-muted-foreground">· {Math.round(s.actual_seconds / 60)} min</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(s.started_at).toLocaleString("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </AppShell>
  );
}