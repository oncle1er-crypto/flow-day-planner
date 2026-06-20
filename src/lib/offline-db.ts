import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "smart-daily-offline";
const DB_VERSION = 1;
const SYNC_STORE = "sync_queue";
const KV_STORE = "kv";

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDB() {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(SYNC_STORE)) {
          db.createObjectStore(SYNC_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(KV_STORE)) {
          db.createObjectStore(KV_STORE);
        }
      },
    });
  }
  return dbPromise;
}

/** Generic async key/value store (used by React Query persister). */
export const idbStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const db = await getDB();
      return (await db.get(KV_STORE, key)) ?? null;
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      const db = await getDB();
      await db.put(KV_STORE, value, key);
    } catch {
      /* ignore */
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      const db = await getDB();
      await db.delete(KV_STORE, key);
    } catch {
      /* ignore */
    }
  },
};

export { SYNC_STORE };
