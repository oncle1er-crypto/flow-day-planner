import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { useTasks } from "@/hooks/use-tasks";
import { useCategories } from "@/hooks/use-categories";
import { TaskCard } from "@/components/app/TaskCard";
import { EmptyState } from "@/components/app/EmptyState";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { History, CheckCircle2, AlertTriangle, ListChecks, TrendingUp, TrendingDown, Sparkles, Trophy } from "lucide-react";
import { format, parseISO, startOfWeek, endOfWeek, subDays, isWithinInterval, eachDayOfInterval } from "date-fns";
import { fr } from "date-fns/locale";
import type { Task } from "@/lib/task-utils";

export const Route = createFileRoute("/_authenticated/history")({ component: HistoryPage });

type Period = "week" | "last_week" | "30d" | "90d";

function periodRange(p: Period): { from: Date; to: Date; label: string } {
  const now = new Date();
  if (p === "week") {
    const from = startOfWeek(now, { weekStartsOn: 1 });
    const to = endOfWeek(now, { weekStartsOn: 1 });
    return { from, to, label: "Cette semaine" };
  }
  if (p === "last_week") {
    const ref = subDays(now, 7);
    return { from: startOfWeek(ref, { weekStartsOn: 1 }), to: endOfWeek(ref, { weekStartsOn: 1 }), label: "Semaine dernière" };
  }
  if (p === "30d") return { from: subDays(now, 29), to: now, label: "30 derniers jours" };
  return { from: subDays(now, 89), to: now, label: "90 derniers jours" };
}

function HistoryPage() {
  const [period, setPeriod] = useState<Period>("week");
  const { from, to, label } = useMemo(() => periodRange(period), [period]);
  const fromISO = format(from, "yyyy-MM-dd");
  const toISO = format(to, "yyyy-MM-dd");

  const { data: tasks = [], isLoading } = useTasks({ range: [fromISO, toISO] });
  const { data: categories = [] } = useCategories();

  const stats = useMemo(() => computeStats(tasks, from, to, categories), [tasks, from, to, categories]);

  return (
    <AppShell title="Historique & bilan" subtitle={label}>
      <div className="space-y-6 pt-4 pb-4">
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList className="w-full">
            <TabsTrigger value="week" className="flex-1 text-xs">Semaine</TabsTrigger>
            <TabsTrigger value="last_week" className="flex-1 text-xs">Précédente</TabsTrigger>
            <TabsTrigger value="30d" className="flex-1 text-xs">30j</TabsTrigger>
            <TabsTrigger value="90d" className="flex-1 text-xs">90j</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Weekly report card */}
        <section className="rounded-3xl bg-gradient-card border border-border p-6 shadow-card relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
          <div className="relative space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Bilan de la période</p>
            </div>
            <div className="flex items-baseline justify-between">
              <div>
                <p className="font-display text-4xl font-bold">{stats.completionRate}<span className="text-2xl text-muted-foreground">%</span></p>
                <p className="text-sm text-muted-foreground mt-1">Taux de réussite</p>
              </div>
              <div className="text-right">
                <p className="font-display text-2xl font-semibold">{stats.done}<span className="text-muted-foreground text-base">/{stats.total}</span></p>
                <p className="text-xs text-muted-foreground">tâches terminées</p>
              </div>
            </div>
            <Progress value={stats.completionRate} className="h-2" />

            <div className="grid grid-cols-3 gap-3 pt-2">
              <MiniStat icon={CheckCircle2} value={stats.done} label="Terminées" tone="success" />
              <MiniStat icon={AlertTriangle} value={stats.missed} label="Manquées" tone="destructive" />
              <MiniStat icon={ListChecks} value={stats.pending} label="En cours" tone="primary" />
            </div>

            <div className="pt-2 space-y-2 text-sm">
              {stats.bestDay && (
                <Insight icon={Trophy} tone="success">
                  Meilleur jour : <b>{format(stats.bestDay.date, "EEEE d MMM", { locale: fr })}</b> ({stats.bestDay.count} terminées)
                </Insight>
              )}
              {stats.topCategory && (
                <Insight icon={TrendingUp} tone="primary">
                  Catégorie la plus active : <b>{stats.topCategory.name}</b> ({stats.topCategory.count} tâches)
                </Insight>
              )}
              {stats.worstCategory && stats.worstCategory.rate < 50 && (
                <Insight icon={TrendingDown} tone="warning">
                  À améliorer : <b>{stats.worstCategory.name}</b> ({stats.worstCategory.rate}% complétées)
                </Insight>
              )}
              <Insight icon={Sparkles} tone="primary">{stats.verdict}</Insight>
            </div>
          </div>
        </section>

        {/* Daily breakdown */}
        {stats.daily.length > 0 && stats.daily.length <= 14 && (
          <section>
            <h2 className="font-display font-semibold mb-3">Activité par jour</h2>
            <div className="rounded-2xl border border-border bg-card/60 p-4">
              <div className="flex items-end gap-1.5 h-32">
                {stats.daily.map((d) => {
                  const max = Math.max(1, ...stats.daily.map((x) => x.total));
                  const h = Math.round((d.total / max) * 100);
                  const doneH = d.total ? Math.round((d.done / d.total) * h) : 0;
                  return (
                    <div key={d.key} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full h-full flex flex-col justify-end rounded-md bg-muted/40 overflow-hidden relative" style={{ minHeight: 8 }}>
                        <div className="bg-primary/30" style={{ height: `${h}%` }} />
                        <div className="absolute bottom-0 left-0 right-0 bg-success" style={{ height: `${doneH}%` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{format(d.date, "EE", { locale: fr })[0].toUpperCase()}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Task lists */}
        <section>
          <h2 className="font-display font-semibold mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" /> Tâches terminées
            <span className="text-xs text-muted-foreground">· {stats.doneList.length}</span>
          </h2>
          <div className="space-y-2">
            {isLoading ? (
              <div className="h-20 rounded-2xl bg-card/40 animate-pulse" />
            ) : stats.doneList.length === 0 ? (
              <EmptyState icon={History} title="Aucune tâche terminée" description="Pas encore d'activité sur cette période." />
            ) : (
              stats.doneList.map((t) => <TaskCard key={t.id} task={t} categories={categories} />)
            )}
          </div>
        </section>

        {stats.missedList.length > 0 && (
          <section>
            <h2 className="font-display font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Manquées
              <span className="text-xs text-muted-foreground">· {stats.missedList.length}</span>
            </h2>
            <div className="space-y-2">
              {stats.missedList.map((t) => <TaskCard key={t.id} task={t} categories={categories} />)}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

function computeStats(tasks: Task[], from: Date, to: Date, categories: { id: string; name: string }[]) {
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Sans catégorie";
  const inRange = tasks.filter((t) => t.due_date && isWithinInterval(parseISO(t.due_date), { start: from, end: to }));
  const done = inRange.filter((t) => t.status === "done").length;
  const total = inRange.length;
  const completionRate = total ? Math.round((done / total) * 100) : 0;
  const now = new Date();
  const missed = inRange.filter((t) => t.status !== "done" && t.status !== "cancelled" && t.due_date && parseISO(t.due_date) < new Date(now.getFullYear(), now.getMonth(), now.getDate())).length;
  const pending = inRange.filter((t) => t.status !== "done" && t.status !== "cancelled").length - missed;

  // Daily breakdown
  const days = eachDayOfInterval({ start: from, end: to });
  const daily = days.map((date) => {
    const key = format(date, "yyyy-MM-dd");
    const dayTasks = inRange.filter((t) => t.due_date === key);
    return { key, date, total: dayTasks.length, done: dayTasks.filter((t) => t.status === "done").length };
  });
  const bestDay = daily.reduce<{ date: Date; count: number } | null>((acc, d) => (d.done > (acc?.count ?? 0) ? { date: d.date, count: d.done } : acc), null);

  // Category stats
  const byCat = new Map<string | null, { total: number; done: number; name: string }>();
  for (const t of inRange) {
    const k = t.category_id;
    const cur = byCat.get(k) ?? { total: 0, done: 0, name: catName(k) };
    cur.total++;
    if (t.status === "done") cur.done++;
    byCat.set(k, cur);
  }
  const catList = Array.from(byCat.entries()).map(([id, v]) => ({ id, name: v.name, count: v.total, rate: v.total ? Math.round((v.done / v.total) * 100) : 0 }));
  // We don't have names from category_id mapping here — patch with placeholder if needed
  const topCategory = catList.sort((a, b) => b.count - a.count)[0] ?? null;
  const worstCategory = catList.filter((c) => c.count >= 2).sort((a, b) => a.rate - b.rate)[0] ?? null;

  let verdict = "Semaine équilibrée, continuez sur cette lancée.";
  if (completionRate >= 80) verdict = "Excellent rythme ! Vous maîtrisez votre planning.";
  else if (completionRate >= 50) verdict = "Bonne progression — visez quelques tâches supplémentaires.";
  else if (total === 0) verdict = "Aucune tâche planifiée sur cette période.";
  else verdict = "Beaucoup de tâches en attente — pensez à prioriser ou reporter.";

  const doneList = inRange.filter((t) => t.status === "done").sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
  const missedList = inRange.filter((t) => t.status !== "done" && t.status !== "cancelled" && t.due_date && parseISO(t.due_date) < new Date(now.getFullYear(), now.getMonth(), now.getDate()));

  return { done, total, missed, pending: Math.max(0, pending), completionRate, daily, bestDay, topCategory, worstCategory, verdict, doneList, missedList };
}

function MiniStat({ icon: Icon, value, label, tone }: { icon: typeof CheckCircle2; value: number; label: string; tone: "success" | "destructive" | "primary" }) {
  const t = { success: "text-success bg-success/10", destructive: "text-destructive bg-destructive/10", primary: "text-primary bg-primary/10" }[tone];
  return (
    <div className="rounded-xl border border-border bg-card/40 p-3">
      <div className={`h-7 w-7 rounded-lg grid place-items-center ${t} mb-2`}><Icon className="h-4 w-4" /></div>
      <p className="font-display text-xl font-bold leading-none">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function Insight({ icon: Icon, tone, children }: { icon: typeof CheckCircle2; tone: "success" | "destructive" | "warning" | "primary"; children: React.ReactNode }) {
  const t = { success: "text-success", destructive: "text-destructive", warning: "text-warning", primary: "text-primary" }[tone];
  return (
    <div className="flex items-start gap-2 rounded-lg bg-card/40 px-3 py-2">
      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${t}`} />
      <p className="text-sm leading-relaxed">{children}</p>
    </div>
  );
}