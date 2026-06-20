import {
  Trophy, Flame, Target, Timer, CheckCircle2, Sparkles, Award, Star, Rocket, Crown, Zap, Calendar,
  type LucideIcon,
} from "lucide-react";

export type Stats = {
  tasksCompleted: number;
  focusMinutes: number;
  focusSessions: number;
  habitLogs: number;
  habitStreakMax: number;
  goalsCompleted: number;
};

export type Achievement = {
  key: string;
  name: string;
  description: string;
  icon: LucideIcon;
  tint: "primary" | "success" | "warning" | "destructive";
  unlocked: (s: Stats, level: number) => boolean;
};

export const ACHIEVEMENTS: Achievement[] = [
  { key: "first_task", name: "Premier pas", description: "Terminer 1 tâche", icon: CheckCircle2, tint: "primary", unlocked: (s) => s.tasksCompleted >= 1 },
  { key: "tasks_10", name: "En rythme", description: "Terminer 10 tâches", icon: CheckCircle2, tint: "primary", unlocked: (s) => s.tasksCompleted >= 10 },
  { key: "tasks_50", name: "Productif", description: "Terminer 50 tâches", icon: Rocket, tint: "primary", unlocked: (s) => s.tasksCompleted >= 50 },
  { key: "tasks_100", name: "Centurion", description: "Terminer 100 tâches", icon: Trophy, tint: "warning", unlocked: (s) => s.tasksCompleted >= 100 },
  { key: "first_habit", name: "Bonne habitude", description: "Cocher une habitude", icon: Flame, tint: "warning", unlocked: (s) => s.habitLogs >= 1 },
  { key: "streak_7", name: "Semaine parfaite", description: "Série de 7 jours", icon: Flame, tint: "warning", unlocked: (s) => s.habitStreakMax >= 7 },
  { key: "streak_30", name: "Imbattable", description: "Série de 30 jours", icon: Crown, tint: "warning", unlocked: (s) => s.habitStreakMax >= 30 },
  { key: "first_focus", name: "Premier focus", description: "1 session de focus", icon: Timer, tint: "success", unlocked: (s) => s.focusSessions >= 1 },
  { key: "focus_60", name: "Concentré", description: "60 min de focus", icon: Zap, tint: "success", unlocked: (s) => s.focusMinutes >= 60 },
  { key: "focus_600", name: "Marathonien", description: "10 h de focus", icon: Star, tint: "success", unlocked: (s) => s.focusMinutes >= 600 },
  { key: "first_goal", name: "Objectif atteint", description: "Terminer un objectif", icon: Target, tint: "destructive", unlocked: (s) => s.goalsCompleted >= 1 },
  { key: "goals_5", name: "Visionnaire", description: "Terminer 5 objectifs", icon: Award, tint: "destructive", unlocked: (s) => s.goalsCompleted >= 5 },
  { key: "level_5", name: "Niveau 5", description: "Atteindre le niveau 5", icon: Sparkles, tint: "primary", unlocked: (_, lvl) => lvl >= 5 },
  { key: "level_10", name: "Niveau 10", description: "Atteindre le niveau 10", icon: Crown, tint: "warning", unlocked: (_, lvl) => lvl >= 10 },
  { key: "level_25", name: "Légende", description: "Atteindre le niveau 25", icon: Trophy, tint: "destructive", unlocked: (_, lvl) => lvl >= 25 },
  { key: "all_rounder", name: "Polyvalent", description: "Tâche + focus + habitude + objectif", icon: Calendar, tint: "primary", unlocked: (s) => s.tasksCompleted >= 1 && s.focusSessions >= 1 && s.habitLogs >= 1 && s.goalsCompleted >= 1 },
];

/** XP calculation. */
export function computeXP(s: Stats): number {
  return (
    s.tasksCompleted * 10 +
    s.focusMinutes * 1 +
    s.habitLogs * 5 +
    s.goalsCompleted * 100
  );
}

/** Level curve: each level requires more XP. Returns {level, xpInLevel, xpForNext}. */
export function levelFromXP(xp: number) {
  // xp to reach level L = 50 * (L-1)^2  => level = floor(sqrt(xp/50)) + 1
  const level = Math.max(1, Math.floor(Math.sqrt(xp / 50)) + 1);
  const xpAtLevelStart = 50 * Math.pow(level - 1, 2);
  const xpAtNextLevel = 50 * Math.pow(level, 2);
  return {
    level,
    xpInLevel: xp - xpAtLevelStart,
    xpForNext: xpAtNextLevel - xpAtLevelStart,
    progressPct: Math.round(((xp - xpAtLevelStart) / (xpAtNextLevel - xpAtLevelStart)) * 100),
  };
}

export function tintClasses(tint: Achievement["tint"]) {
  return {
    primary: "text-primary bg-primary/10",
    success: "text-success bg-success/10",
    warning: "text-warning bg-warning/10",
    destructive: "text-destructive bg-destructive/10",
  }[tint];
}