/**
 * Deduplication key shared by the push dispatcher and the in-app notification
 * center. One reminder = one key = at most one `notifications` row
 * (enforced by the unique index on (user_id, dedupe_key)), so a push
 * notification and its in-app counterpart never duplicate each other.
 */
export type ReminderKind = "task" | "daily";

export function reminderDedupeKey(
  kind: ReminderKind,
  refId: string,
  scheduledForISO: string,
): string {
  // Minute precision: retries within the same cron window collapse to one key.
  const minute = scheduledForISO.slice(0, 16);
  return `${kind}:${refId}:${minute}`;
}
