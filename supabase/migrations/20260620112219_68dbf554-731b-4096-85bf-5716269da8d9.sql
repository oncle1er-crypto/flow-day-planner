CREATE TYPE public.goal_type AS ENUM ('short', 'long');
CREATE TYPE public.goal_status AS ENUM ('active', 'done', 'paused');

CREATE TABLE public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  type public.goal_type NOT NULL DEFAULT 'short',
  status public.goal_status NOT NULL DEFAULT 'active',
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  target_date date,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  color text,
  position integer NOT NULL DEFAULT 0,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own goals"
  ON public.goals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX goals_user_status_idx ON public.goals(user_id, status) WHERE is_archived = false;
CREATE INDEX goals_user_type_idx ON public.goals(user_id, type);

CREATE TRIGGER goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();