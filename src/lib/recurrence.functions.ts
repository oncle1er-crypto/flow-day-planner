import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { buildNextOccurrence, type RecurringTaskSource } from "@/lib/recurrence";

const SELECT =
  "id,user_id,title,description,due_date,due_time,priority,category_id,tags,color,icon,notes,reminder_enabled,recurrence,recurrence_config,recurrence_end_date,recurrence_parent_id,occurrence_index";

/** Postgres unique-violation: the occurrence already exists → nothing to do. */
function isDuplicate(err: { code?: string } | null): boolean {
  return err?.code === "23505";
}

type Client = Parameters<typeof buildNextOccurrence> extends never ? never : any;

async function createOccurrence(
  supabase: any,
  source: RecurringTaskSource,
): Promise<string | null> {
  const row = buildNextOccurrence(source);
  if (!row) return null;

  const { data, error } = await supabase.from("tasks").insert(row).select("id").maybeSingle();
  if (error) {
    if (isDuplicate(error)) return null;
    throw new Error(error.message);
  }
  const newId = data?.id as string | undefined;
  if (!newId) return null;

  // Carry over the subtask checklist (reset to "not done").
  const { data: subs } = await supabase
    .from("subtasks")
    .select("title,position")
    .eq("task_id", source.id)
    .order("position", { ascending: true });
  if (subs && subs.length) {
    await supabase.from("subtasks").insert(
      subs.map((s: { title: string; position: number }) => ({
        user_id: source.user_id,
        task_id: newId,
        title: s.title,
        position: s.position,
        is_done: false,
      })),
    );
  }
  return newId;
}

/** Called right after a recurring task is completed. Idempotent. */
export const generateNextOccurrence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ taskId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: task, error } = await supabase.from("tasks").select(SELECT).eq("id", data.taskId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!task) return { created: null as string | null };
    const created = await createOccurrence(supabase, task as unknown as RecurringTaskSource);
    return { created };
  });

/**
 * Catch-up pass: for every recurring series whose latest occurrence is due
 * today or in the past, make sure the next occurrence exists. Idempotent
 * thanks to the unique index on (user_id, series root, due_date).
 */
export const ensureRecurringOccurrences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const today = new Date().toISOString().slice(0, 10);
    const { data: tasks, error } = await supabase
      .from("tasks")
      .select(SELECT)
      .neq("recurrence", "none")
      .eq("is_archived", false)
      .not("due_date", "is", null)
      .lte("due_date", today)
      .order("due_date", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    // Keep only the most recent occurrence of each series.
    const latestBySeries = new Map<string, RecurringTaskSource>();
    for (const t of (tasks ?? []) as unknown as RecurringTaskSource[]) {
      const root = t.recurrence_parent_id ?? t.id;
      const current = latestBySeries.get(root);
      if (!current || (t.due_date ?? "") > (current.due_date ?? "")) latestBySeries.set(root, t);
    }

    let created = 0;
    for (const source of latestBySeries.values()) {
      try {
        if (await createOccurrence(supabase, source)) created++;
      } catch (err) {
        console.error("[recurrence] occurrence failed", err);
      }
    }
    return { created };
  });
