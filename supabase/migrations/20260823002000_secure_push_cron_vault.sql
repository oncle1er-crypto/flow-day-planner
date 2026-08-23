CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Secure replacement for the legacy push-reminders cron.
-- The cron authentication secret is NEVER stored in this repository or in cron.job.
--
-- Store the SAME value used by the Lovable Cloud secret
-- PUSH_REMINDERS_CRON_SECRET in PostgreSQL Vault before applying this migration:
--   name: push_reminders_cron_secret
--   value: the same long random secret
--
-- The Edge Function verifies x-cron-secret, while its Supabase server key remains
-- internal to the Edge Function runtime and is never passed through pg_cron.

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
      'x-cron-secret', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'push_reminders_cron_secret'
        ORDER BY created_at DESC
        LIMIT 1
      )
    ),
    body := jsonb_build_object('source', 'pg_cron')
  ) AS request_id;
  $$
);
