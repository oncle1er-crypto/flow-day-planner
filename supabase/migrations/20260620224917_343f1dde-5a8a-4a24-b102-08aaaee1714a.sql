-- Restrict RLS policies to authenticated role only
DROP POLICY IF EXISTS "Users manage own focus sessions" ON public.focus_sessions;
CREATE POLICY "Users manage own focus sessions" ON public.focus_sessions
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage their own goals" ON public.goals;
CREATE POLICY "Users manage their own goals" ON public.goals
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage their own habit logs" ON public.habit_logs;
CREATE POLICY "Users manage their own habit logs" ON public.habit_logs
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage their own habits" ON public.habits;
CREATE POLICY "Users manage their own habits" ON public.habits
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own achievements" ON public.user_achievements;
CREATE POLICY "Users manage own achievements" ON public.user_achievements
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Add DELETE policy for profiles (account deletion support)
CREATE POLICY "Users can delete own profile" ON public.profiles
  FOR DELETE TO authenticated USING (auth.uid() = id);
