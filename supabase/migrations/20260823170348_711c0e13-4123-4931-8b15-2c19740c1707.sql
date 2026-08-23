CREATE OR REPLACE FUNCTION public.sync_my_achievements()
RETURNS TABLE(achievement_key text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  v_tasks int := 0;
  v_focus_sessions int := 0;
  v_focus_minutes int := 0;
  v_habit_logs int := 0;
  v_streak_max int := 0;
  v_goals int := 0;
  v_xp int := 0;
  v_level int := 1;
  earned text[] := '{}';
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT count(*) INTO v_tasks
  FROM public.tasks WHERE user_id = uid AND status = 'done';

  SELECT count(*), COALESCE(floor(sum(actual_seconds) / 60), 0)
  INTO v_focus_sessions, v_focus_minutes
  FROM public.focus_sessions
  WHERE user_id = uid AND completed = true AND kind = 'focus';

  SELECT count(*) INTO v_habit_logs
  FROM public.habit_logs WHERE user_id = uid;

  SELECT count(*) INTO v_goals
  FROM public.goals WHERE user_id = uid AND status = 'done';

  -- longest consecutive-day streak over distinct habit log dates
  WITH d AS (
    SELECT DISTINCT log_date FROM public.habit_logs WHERE user_id = uid
  ), g AS (
    SELECT log_date, log_date - (row_number() OVER (ORDER BY log_date))::int AS grp
    FROM d
  )
  SELECT COALESCE(max(cnt), 0) INTO v_streak_max
  FROM (SELECT count(*) AS cnt FROM g GROUP BY grp) s;

  v_xp := v_tasks * 10 + v_focus_minutes + v_habit_logs * 5 + v_goals * 100;
  v_level := GREATEST(1, floor(sqrt(v_xp::numeric / 50))::int + 1);

  IF v_tasks >= 1 THEN earned := array_append(earned, 'first_task'); END IF;
  IF v_tasks >= 10 THEN earned := array_append(earned, 'tasks_10'); END IF;
  IF v_tasks >= 50 THEN earned := array_append(earned, 'tasks_50'); END IF;
  IF v_tasks >= 100 THEN earned := array_append(earned, 'tasks_100'); END IF;
  IF v_habit_logs >= 1 THEN earned := array_append(earned, 'first_habit'); END IF;
  IF v_streak_max >= 7 THEN earned := array_append(earned, 'streak_7'); END IF;
  IF v_streak_max >= 30 THEN earned := array_append(earned, 'streak_30'); END IF;
  IF v_focus_sessions >= 1 THEN earned := array_append(earned, 'first_focus'); END IF;
  IF v_focus_minutes >= 60 THEN earned := array_append(earned, 'focus_60'); END IF;
  IF v_focus_minutes >= 600 THEN earned := array_append(earned, 'focus_600'); END IF;
  IF v_goals >= 1 THEN earned := array_append(earned, 'first_goal'); END IF;
  IF v_goals >= 5 THEN earned := array_append(earned, 'goals_5'); END IF;
  IF v_level >= 5 THEN earned := array_append(earned, 'level_5'); END IF;
  IF v_level >= 10 THEN earned := array_append(earned, 'level_10'); END IF;
  IF v_level >= 25 THEN earned := array_append(earned, 'level_25'); END IF;
  IF v_tasks >= 1 AND v_focus_sessions >= 1 AND v_habit_logs >= 1 AND v_goals >= 1
    THEN earned := array_append(earned, 'all_rounder'); END IF;

  RETURN QUERY
  INSERT INTO public.user_achievements AS ua (user_id, achievement_key)
  SELECT uid, k FROM unnest(earned) AS k
  ON CONFLICT ON CONSTRAINT user_achievements_pkey DO NOTHING
  RETURNING ua.achievement_key;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_my_achievements() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_my_achievements() FROM anon;
GRANT EXECUTE ON FUNCTION public.sync_my_achievements() TO authenticated;