import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Delegates the whole check to the `sync_my_achievements()` SECURITY DEFINER
 * database function: it recomputes the criteria from the authenticated user's
 * own rows (via auth.uid()), inserts only the badges actually earned and
 * returns the newly unlocked keys. No service-role key is required.
 */
export const syncAchievements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("sync_my_achievements");
    if (error) {
      console.error("[achievements] sync failed", error);
      throw new Error("Impossible d'enregistrer les badges.");
    }
    const unlocked = (data ?? []).map((r: { achievement_key: string }) => r.achievement_key);
    return { unlocked };
  });

