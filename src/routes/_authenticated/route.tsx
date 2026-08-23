import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ensureRecurringOccurrences } from "@/lib/recurrence.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  useEffect(() => {
    let cancelled = false;

    const ensureRecurrence = async () => {
      try {
        await ensureRecurringOccurrences();
      } catch (error) {
        if (!cancelled) console.error("[recurrence] catch-up failed", error);
      }
    };

    void ensureRecurrence();
    return () => {
      cancelled = true;
    };
  }, []);

  return <Outlet />;
}
