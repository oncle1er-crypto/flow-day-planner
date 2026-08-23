-- Defense in depth: prevent authenticated users from linking their rows to
-- resources owned by another account when they happen to know a UUID.
--
-- The NOT VALID foreign keys protect all NEW/UPDATED rows immediately without
-- failing deployment because of possible legacy cross-owner references. A
-- later data audit can safely VALIDATE CONSTRAINT after confirming old rows.

CREATE UNIQUE INDEX IF NOT EXISTS categories_id_user_uidx
  ON public.categories(id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS tasks_id_user_uidx
  ON public.tasks(id, user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_category_same_owner_fkey'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_category_same_owner_fkey
      FOREIGN KEY (category_id, user_id)
      REFERENCES public.categories(id, user_id)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subtasks_task_same_owner_fkey'
  ) THEN
    ALTER TABLE public.subtasks
      ADD CONSTRAINT subtasks_task_same_owner_fkey
      FOREIGN KEY (task_id, user_id)
      REFERENCES public.tasks(id, user_id)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'goals_category_same_owner_fkey'
  ) THEN
    ALTER TABLE public.goals
      ADD CONSTRAINT goals_category_same_owner_fkey
      FOREIGN KEY (category_id, user_id)
      REFERENCES public.categories(id, user_id)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'focus_sessions_task_same_owner_fkey'
  ) THEN
    ALTER TABLE public.focus_sessions
      ADD CONSTRAINT focus_sessions_task_same_owner_fkey
      FOREIGN KEY (task_id, user_id)
      REFERENCES public.tasks(id, user_id)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_task_same_owner_fkey'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_task_same_owner_fkey
      FOREIGN KEY (task_id, user_id)
      REFERENCES public.tasks(id, user_id)
      NOT VALID;
  END IF;
END $$;
