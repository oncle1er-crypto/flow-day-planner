import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "flow-day-timezone-synced";

/** Keep reminder calculations aligned with the device's current IANA timezone. */
export function useTimezoneSync() {
  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      if (typeof window === "undefined" || typeof Intl === "undefined") return;
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!timezone) return;

      const cached = window.localStorage.getItem(STORAGE_KEY);
      if (cached === timezone) return;

      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user || cancelled) return;

      const { data: settings, error: readError } = await supabase
        .from("user_settings")
        .select("timezone")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (readError || cancelled) return;

      if (settings?.timezone !== timezone) {
        const { error: updateError } = await supabase
          .from("user_settings")
          .update({ timezone })
          .eq("user_id", auth.user.id);
        if (updateError || cancelled) return;
      }

      window.localStorage.setItem(STORAGE_KEY, timezone);
    };

    void sync();
    return () => {
      cancelled = true;
    };
  }, []);
}
