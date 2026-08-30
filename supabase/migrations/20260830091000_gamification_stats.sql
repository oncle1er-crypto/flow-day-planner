create or replace function public.get_my_gamification_stats()
returns table(
  tasks_completed bigint,
  focus_sessions bigint,
  focus_minutes bigint,
  habit_logs bigint,
  habit_streak_max bigint,
  goals_completed bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with uid as (select auth.uid() as id),
  habit_days as (
    select distinct log_date
    from public.habit_logs, uid
    where user_id = uid.id
  ),
  habit_groups as (
    select log_date, log_date - (row_number() over (order by log_date))::int as grp
    from habit_days
  ),
  streak as (
    select coalesce(max(day_count), 0)::bigint as value
    from (select count(*) as day_count from habit_groups group by grp) grouped_days
  )
  select
    (select count(*) from public.tasks, uid where user_id = uid.id and status = 'done'),
    (select count(*) from public.focus_sessions, uid
      where user_id = uid.id and completed = true and kind = 'focus'),
    (select coalesce(floor(sum(actual_seconds) / 60), 0)::bigint
      from public.focus_sessions, uid
      where user_id = uid.id and completed = true and kind = 'focus'),
    (select count(*) from public.habit_logs, uid where user_id = uid.id),
    (select value from streak),
    (select count(*) from public.goals, uid where user_id = uid.id and status = 'done')
  where (select id from uid) is not null;
$$;

revoke all on function public.get_my_gamification_stats() from public, anon;
grant execute on function public.get_my_gamification_stats() to authenticated;
