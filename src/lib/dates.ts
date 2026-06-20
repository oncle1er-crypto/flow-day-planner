import { format, formatDistanceToNow, isToday, isTomorrow, isYesterday, isPast, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, addDays, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";

export { format, isToday, isTomorrow, isYesterday, isPast, startOfDay, endOfDay, startOfWeek, endOfWeek, addDays, isSameDay, parseISO };

export function greetingForNow(name?: string | null) {
  const h = new Date().getHours();
  const base = h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";
  return name ? `${base}, ${name.split(" ")[0]}` : base;
}

export function fmtDate(d: string | Date | null | undefined, pattern = "EEEE d MMMM") {
  if (!d) return "";
  const date = typeof d === "string" ? parseISO(d) : d;
  return format(date, pattern, { locale: fr });
}

export function fmtRelative(d: string | Date) {
  const date = typeof d === "string" ? parseISO(d) : d;
  return formatDistanceToNow(date, { addSuffix: true, locale: fr });
}

export function smartDateLabel(dateStr: string | null | undefined) {
  if (!dateStr) return "Sans date";
  const d = parseISO(dateStr);
  if (isToday(d)) return "Aujourd'hui";
  if (isTomorrow(d)) return "Demain";
  if (isYesterday(d)) return "Hier";
  return format(d, "d MMM", { locale: fr });
}

export function todayISO() {
  return format(new Date(), "yyyy-MM-dd");
}