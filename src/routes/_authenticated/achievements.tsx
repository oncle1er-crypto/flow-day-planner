import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { Progress } from "@/components/ui/progress";
import { ACHIEVEMENTS, tintClasses } from "@/lib/gamification";
import { useGamification } from "@/hooks/use-gamification";
import { Lock, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/achievements")({ component: AchievementsPage });

function AchievementsPage() {
  const { stats, xp, level, unlocked, isLoading } = useGamification();

  const totalAchievements = ACHIEVEMENTS.length;
  const unlockedCount = unlocked.size;

  return (
    <AppShell title="Récompenses" subtitle="Votre progression et vos badges">
      <div className="space-y-6 pt-4">
        {/* Level card */}
        <section className="rounded-3xl bg-gradient-card border border-border p-6 shadow-card relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-2xl bg-gradient-primary shadow-glow grid place-items-center text-primary-foreground">
                  <Trophy className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Niveau</p>
                  <p className="font-display text-4xl font-bold leading-none">{level.level}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">XP total</p>
                <p className="font-display text-2xl font-semibold">{xp}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Progress value={level.progressPct} className="h-2" />
              <p className="text-xs text-muted-foreground text-right">
                {level.xpInLevel} / {level.xpForNext} XP → niveau {level.level + 1}
              </p>
            </div>
          </div>
        </section>

        {/* Stats grid */}
        {stats && (
          <section className="grid grid-cols-2 gap-3">
            <Stat label="Tâches terminées" value={stats.tasksCompleted} />
            <Stat label="Minutes de focus" value={stats.focusMinutes} />
            <Stat label="Habitudes cochées" value={stats.habitLogs} />
            <Stat label="Meilleure série" value={`${stats.habitStreakMax} j`} />
            <Stat label="Objectifs atteints" value={stats.goalsCompleted} />
            <Stat label="Sessions focus" value={stats.focusSessions} />
          </section>
        )}

        {/* Badges */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-semibold text-lg">Badges</h2>
            <p className="text-sm text-muted-foreground">{unlockedCount}/{totalAchievements}</p>
          </div>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {ACHIEVEMENTS.map((a) => {
                const isUnlocked = unlocked.has(a.key);
                const Icon = a.icon;
                return (
                  <div
                    key={a.key}
                    className={cn(
                      "rounded-2xl border p-4 shadow-card transition",
                      isUnlocked ? "border-border bg-card/80" : "border-border/40 bg-card/30 opacity-60",
                    )}
                  >
                    <div className={cn("h-10 w-10 rounded-xl grid place-items-center mb-3", isUnlocked ? tintClasses(a.tint) : "bg-muted/40 text-muted-foreground")}>
                      {isUnlocked ? <Icon className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
                    </div>
                    <p className="font-display font-semibold text-sm leading-tight">{a.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{a.description}</p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4 shadow-card">
      <p className="font-display text-2xl font-bold leading-none">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}