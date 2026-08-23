CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- SECURITY NOTE
-- This historical migration previously contained a hardcoded service_role JWT.
-- The credential has been deliberately removed from the current repository tree.
-- Rotating/revoking the exposed credential remains mandatory because Git history
-- may still contain the previous value.
--
-- Scheduling is now configured by a later migration using a secret read from
-- Supabase Vault. Never place service_role keys or cron secrets in migrations.

DO $$
BEGIN
  PERFORM cron.unschedule('push-reminders-minutely')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'push-reminders-minutely');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
