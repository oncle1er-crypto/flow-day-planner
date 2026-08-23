CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Secure replacement for the legacy push-reminders cron.
-- The service-role JWT is NEVER stored in this repository or in cron.job.
-- Before applying this migration in production, create/replace the Vault secret:
--   name: push_reminders_service_role_jwt
--   value: the NEW rotated Supabase service_role JWT
--
-- The cron command reads the decrypted value at execution time from Vault.

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
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'push_reminders_service_role_jwt'
        ORDER BY created_at DESC
        LIMIT 1
      )
    ),
    body := jsonb_build_object('source', 'pg_cron')
  ) AS request_id;
  $$
);
