
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any previous schedule with the same name (idempotent)
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
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqZGh2emphcWFybHFjcXBrZnpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTkzOTk5MCwiZXhwIjoyMDk3NTE1OTkwfQ.b05l5NBQt-3W5cw0dm7Fdw4BjnHFEHVa3Gqk9FuCgho'
    ),
    body := jsonb_build_object('source', 'pg_cron')
  ) AS request_id;
  $$
);
