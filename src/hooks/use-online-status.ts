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
    (cb) => subscribeQueue(cb),
    () => _cachedCount,
    () => 0,
  );
}

let _cachedCount = 0;
async function refreshCount() {
  _cachedCount = await queueSize();
}

/** Mount once: refresh count, listen for online events, auto-flush. */
export function useOfflineSync() {
  const qc = useQueryClient();
  const online = useOnlineStatus();

  useEffect(() => {
    refreshCount();
    const unsub = subscribeQueue(() => {
      refreshCount();
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
        toast.success(`${applied} modification${applied > 1 ? "s" : ""} synchronisée${applied > 1 ? "s" : ""}`);
        qc.invalidateQueries();
      }
      if (failed > 0) {
        toast.error("Synchronisation interrompue, nous réessaierons");
      }
    })();
  }, [online, qc]);
}
