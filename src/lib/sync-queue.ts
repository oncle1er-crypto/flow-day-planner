import { supabase } from "@/integrations/supabase/client";
import { getDB, SYNC_STORE } from "./offline-db";

export type SyncAction = "insert" | "update" | "delete";

export interface SyncOp {
  id: string;
  table: string;
  action: SyncAction;
  payload?: Record<string, unknown>;
  match?: Record<string, unknown>;
  createdAt: number;
  tempId?: string;
  attempts?: number;
  lastAttemptAt?: number;
  lastError?: string;
}

const ALLOWED_TABLES = new Set([
  "tasks",
  "subtasks",
  "habits",
  "habit_logs",
  "goals",
  "focus_sessions",
  "categories",
]);

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}
export function subscribeQueue(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export async function enqueueOp(
  op: Omit<SyncOp, "id" | "createdAt"> & { id?: string },
): Promise<SyncOp> {
  if (!ALLOWED_TABLES.has(op.table)) {
    throw new Error(`La synchronisation hors ligne ne prend pas en charge la table ${op.table}.`);
  }
  const full: SyncOp = {
    id: op.id ?? crypto.randomUUID(),
    createdAt: Date.now(),
    ...op,
  };
  const db = await getDB();
  await db.put(SYNC_STORE, full);
  notify();
  return full;
}

export async function getQueue(): Promise<SyncOp[]> {
  try {
    const db = await getDB();
    const all = (await db.getAll(SYNC_STORE)) as SyncOp[];
    return all.sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

export async function queueSize(): Promise<number> {
  try {
    const db = await getDB();
    return await db.count(SYNC_STORE);
  } catch {
    return 0;
  }
}

async function removeOp(id: string) {
  const db = await getDB();
  await db.delete(SYNC_STORE, id);
  notify();
}

async function recordFailure(op: SyncOp, error: unknown) {
  const db = await getDB();
  const message = error instanceof Error ? error.message : String(error);
  await db.put(SYNC_STORE, {
    ...op,
    attempts: (op.attempts ?? 0) + 1,
    lastAttemptAt: Date.now(),
    lastError: message.slice(0, 500),
  });
  notify();
}

async function applyOp(op: SyncOp): Promise<void> {
  const tbl = supabase.from(op.table as never);
  if (op.action === "insert" && op.payload) {
    // Runtime table names are an intentional boundary of the generic offline queue.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (tbl as any).insert(op.payload);
    if (error) throw error;
  } else if (op.action === "update" && op.payload && op.match) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (tbl as any).update(op.payload);
    for (const [k, v] of Object.entries(op.match)) q = q.eq(k, v);
    const { error } = await q;
    if (error) throw error;
  } else if (op.action === "delete" && op.match) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (tbl as any).delete();
    for (const [k, v] of Object.entries(op.match)) q = q.eq(k, v);
    const { error } = await q;
    if (error) throw error;
  }
}

let flushing = false;

export async function flushQueue(): Promise<{ applied: number; failed: number }> {
  if (flushing) return { applied: 0, failed: 0 };
  if (typeof navigator !== "undefined" && !navigator.onLine) return { applied: 0, failed: 0 };
  flushing = true;
  let applied = 0;
  let failed = 0;
  try {
    const ops = await getQueue();
    for (const op of ops) {
      try {
        await applyOp(op);
        await removeOp(op.id);
        applied++;
      } catch (e) {
        failed++;
        await recordFailure(op, e);
        console.error("[sync-queue] op failed", op, e);
        // Preserve the failed operation for a later retry, but do not let it
        // permanently block unrelated changes queued behind it.
      }
    }
  } finally {
    flushing = false;
  }
  return { applied, failed };
}

export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}
