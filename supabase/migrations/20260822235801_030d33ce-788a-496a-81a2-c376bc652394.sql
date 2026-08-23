-- 1) Remove the cron job that embedded a service_role key in its definition
DO $$
BEGIN
  PERFORM cron.unschedule('push-reminders-minutely')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'push-reminders-minutely');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Re-schedule using the project's PUBLISHABLE (anon) key only. No secret in the repo.
SELECT cron.schedule(
  'push-reminders-minutely',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://sjdhvzjaqarlqcqpkfzd.supabase.co/functions/v1/push-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqZGh2emphcWFybHFjcXBrZnpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5Mzk5OTAsImV4cCI6MjA5NzUxNTk5MH0.axZ9NV9_3WzO6HW0MOAOSZjKydjyoHCWWxQyMlA1sGM'
    ),
    body := jsonb_build_object('source', 'pg_cron')
  ) AS request_id;
  $$
);

-- 2) In-app notifications: dedupe key
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS dedupe_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_dedupe_uidx
  ON public.notifications(user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

-- 3) Recurring tasks: series link + occurrence counter + idempotency guard
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS recurrence_parent_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL;
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS occurrence_index INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS tasks_recurrence_parent_idx
  ON public.tasks(recurrence_parent_id);

-- One occurrence per (series root, due date): makes generation idempotent
CREATE UNIQUE INDEX IF NOT EXISTS tasks_recurrence_slot_uidx
  ON public.tasks(user_id, COALESCE(recurrence_parent_id, id), due_date)
  WHERE recurrence <> 'none'::recurrence_type AND due_date IS NOT NULL;