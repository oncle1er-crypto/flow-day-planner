import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ensureRecurringOccurrences } from "@/lib/recurrence.functions";
import { isOnline } from "@/lib/sync-queue";
import { todayISO } from "@/lib/dates";

const RUN_KEY = "sdt:recurrence-catchup";

/**
 * Once per day (and only online), makes sure every recurring series has its
 * next occurrence. The server function is idempotent, so an extra run is safe.
 */
export function useRecurrenceCatchup() {
  const qc = useQueryClient();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (!isOnline()) return;

    const today = todayISO();
    try {
      if (localStorage.getItem(RUN_KEY) === today) return;
    } catch {
      /* storage unavailable — run anyway */
    }

    void (async () => {
      try {
        const res = await ensureRecurringOccurrences();
        try {
          localStorage.setItem(RUN_KEY, today);
        } catch {
          /* ignore */
        }
        if (res?.created) qc.invalidateQueries({ queryKey: ["tasks"] });
      } catch (err) {
        console.error("[recurrence] catch-up failed", err);
      }
    })();
  }, [qc]);
}
