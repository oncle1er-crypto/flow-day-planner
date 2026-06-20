import { supabase } from "@/integrations/supabase/client";
import { getDB, SYNC_STORE } from "./offline-db";

export type SyncAction = "insert" | "update" | "delete";

export interface SyncOp {
  id: string;
  table: string;
  action: SyncAction;
  /** Row data for insert/update */
  payload?: Record<string, unknown>;
  /** Equality filter columns for update/delete */
  match?: Record<string, unknown>;
  createdAt: number;
  /** When defined, replaces this temp id with the server-generated id in subsequent ops */
  tempId?: string;
}

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

export async function enqueueOp(op: Omit<SyncOp, "id" | "createdAt"> & { id?: string }): Promise<SyncOp> {
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

async function applyOp(op: SyncOp): Promise<void> {
  const tbl = supabase.from(op.table as never);
  if (op.action === "insert" && op.payload) {
    const { error } = await (tbl as any).insert(op.payload);
    if (error) throw error;
  } else if (op.action === "update" && op.payload && op.match) {
    let q = (tbl as any).update(op.payload);
    for (const [k, v] of Object.entries(op.match)) q = q.eq(k, v);
    const { error } = await q;
    if (error) throw error;
  } else if (op.action === "delete" && op.match) {
    let q = (tbl as any).delete();
    for (const [k, v] of Object.entries(op.match)) q = q.eq(k, v);
    const { error } = await q;
    if (error) throw error;
  }
}

let flushing = false;

/** Drains the queue sequentially. Stops on first error so order is preserved. */
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
        console.error("[sync-queue] op failed", op, e);
        break;
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
