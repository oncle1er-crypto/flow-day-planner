REVOKE INSERT, UPDATE, DELETE ON public.user_achievements FROM authenticated;
DROP POLICY IF EXISTS "Users can insert their own achievements" ON public.user_achievements;
DROP POLICY IF EXISTS "Users insert own achievements" ON public.user_achievements;
DROP POLICY IF EXISTS "users_insert_own_achievements" ON public.user_achievements;