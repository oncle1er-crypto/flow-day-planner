
CREATE TYPE public.focus_kind AS ENUM ('focus', 'short_break', 'long_break');

CREATE TABLE public.focus_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  kind public.focus_kind NOT NULL DEFAULT 'focus',
  planned_minutes INTEGER NOT NULL DEFAULT 25,
  actual_seconds INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  completed BOOLEAN NOT NULL DEFAULT false,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX focus_sessions_user_started_idx ON public.focus_sessions(user_id, started_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.focus_sessions TO authenticated;
GRANT ALL ON public.focus_sessions TO service_role;

ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own focus sessions"
  ON public.focus_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_focus_sessions_updated_at
  BEFORE UPDATE ON public.focus_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
