import { useEffect, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { flushQueue, queueSize, subscribeQueue, isOnline } from "@/lib/sync-queue";

function subscribe(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => (typeof navigator === "undefined" ? true : navigator.onLine),
    () => true,
  );
}

export function usePendingSyncCount(): number {
  return useSyncExternalStore(
    subscribePendingCount,
    () => _cachedCount,
    () => 0,
  );
}

let _cachedCount = 0;
const pendingCountListeners = new Set<() => void>();

function subscribePendingCount(callback: () => void) {
  pendingCountListeners.add(callback);
  return () => pendingCountListeners.delete(callback);
}

async function refreshCount() {
  const next = await queueSize();
  if (next === _cachedCount) return;
  _cachedCount = next;
  pendingCountListeners.forEach((listener) => listener());
}

/** Mount once: refresh count, listen for online events, auto-flush. */
export function useOfflineSync() {
  const qc = useQueryClient();
  const online = useOnlineStatus();

  useEffect(() => {
    void refreshCount();
    const unsub = subscribeQueue(() => {
      void refreshCount();
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!online) {
      toast.info("Hors-ligne : vos modifications seront synchronisées au retour");
      return;
    }
    (async () => {
      const before = await queueSize();
      if (before === 0) return;
      const { applied, failed } = await flushQueue();
      await refreshCount();
      if (applied > 0) {
        toast.success(
          `${applied} modification${applied > 1 ? "s" : ""} synchronisée${applied > 1 ? "s" : ""}`,
        );
        qc.invalidateQueries();
      }
      if (failed > 0) {
        toast.error(
          `${failed} modification${failed > 1 ? "s" : ""} n'a pas pu être synchronisée. Une nouvelle tentative sera effectuée.`,
        );
      }
    })();
  }, [online, qc]);

  useEffect(() => {
    if (!online) return;
    const timer = window.setInterval(() => {
      void (async () => {
        if ((await queueSize()) === 0) return;
        const { applied } = await flushQueue();
        await refreshCount();
        if (applied > 0) qc.invalidateQueries();
      })();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [online, qc]);
}
