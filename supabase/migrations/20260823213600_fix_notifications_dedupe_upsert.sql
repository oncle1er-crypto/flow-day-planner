-- Allow PostgREST/Supabase upsert(onConflict: 'user_id,dedupe_key') to target
-- the notification dedupe index. PostgreSQL unique indexes allow multiple NULL
-- values, so removing the partial predicate preserves legacy rows without keys.
DROP INDEX IF EXISTS public.notifications_user_dedupe_uidx;
CREATE UNIQUE INDEX notifications_user_dedupe_uidx
  ON public.notifications (user_id, dedupe_key);
