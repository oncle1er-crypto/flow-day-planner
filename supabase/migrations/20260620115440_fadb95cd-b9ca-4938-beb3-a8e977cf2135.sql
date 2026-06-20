ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS daily_reminder_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS daily_reminder_time TIME NOT NULL DEFAULT '09:00:00';