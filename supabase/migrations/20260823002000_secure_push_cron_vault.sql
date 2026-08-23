CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Secure replacement for the legacy push-reminders cron.
-- The backend API key is NEVER stored in this repository or in cron.job.
--
-- Supabase now recommends replacing legacy service_role JWTs with a new
-- server-side secret key (sb_secret_...). Store that key in Vault before
-- applying this migration:
--   name: push_reminders_server_key
--   value: the NEW sb_secret_... key
--
-- pg_net must send modern secret keys in the `apikey` header. The Edge Function
-- independently compares that value with its own platform-provided secret key.

DO $$
BEGIN
  PERFORM cron.unschedule('push-reminders-minutely')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'push-reminders-minutely');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'push-reminders-minutely',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://sjdhvzjaqarlqcqpkfzd.supabase.co/functions/v1/push-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'push_reminders_server_key'
        ORDER BY created_at DESC
        LIMIT 1
      )
    ),
    body := jsonb_build_object('source', 'pg_cron')
  ) AS request_id;
  $$
);
