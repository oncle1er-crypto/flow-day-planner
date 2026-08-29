create table public.finance_security (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pin_hash text not null,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.finance_security enable row level security;

-- No direct table policies: the PIN hash is intentionally inaccessible to clients.

create or replace function public.has_finance_pin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.finance_security where user_id = auth.uid()
  );
$$;

create or replace function public.set_finance_pin(new_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;

  if new_pin is null or new_pin !~ '^[0-9]{4}$' then
    raise exception 'Le code doit contenir exactement 4 chiffres';
  end if;

  insert into public.finance_security(user_id, pin_hash, failed_attempts, locked_until, updated_at)
  values (auth.uid(), crypt(new_pin, gen_salt('bf', 10)), 0, null, now())
  on conflict (user_id) do update
  set pin_hash = excluded.pin_hash,
      failed_attempts = 0,
      locked_until = null,
      updated_at = now();
end;
$$;

create or replace function public.verify_finance_pin(candidate_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  row_data public.finance_security%rowtype;
  is_valid boolean := false;
  remaining integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;

  if candidate_pin is null or candidate_pin !~ '^[0-9]{4}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_format', 'remaining_attempts', 0);
  end if;

  select * into row_data
  from public.finance_security
  where user_id = auth.uid()
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_configured', 'remaining_attempts', 0);
  end if;

  if row_data.locked_until is not null and row_data.locked_until > now() then
    return jsonb_build_object(
      'ok', false,
      'reason', 'locked',
      'locked_until', row_data.locked_until,
      'remaining_attempts', 0
    );
  end if;

  is_valid := row_data.pin_hash = crypt(candidate_pin, row_data.pin_hash);

  if is_valid then
    update public.finance_security
    set failed_attempts = 0, locked_until = null, updated_at = now()
    where user_id = auth.uid();
    return jsonb_build_object('ok', true, 'reason', 'verified', 'remaining_attempts', 5);
  end if;

  row_data.failed_attempts := coalesce(row_data.failed_attempts, 0) + 1;
  remaining := greatest(5 - row_data.failed_attempts, 0);

  if row_data.failed_attempts >= 5 then
    update public.finance_security
    set failed_attempts = 0,
        locked_until = now() + interval '15 minutes',
        updated_at = now()
    where user_id = auth.uid();
    return jsonb_build_object(
      'ok', false,
      'reason', 'locked',
      'locked_until', now() + interval '15 minutes',
      'remaining_attempts', 0
    );
  end if;

  update public.finance_security
  set failed_attempts = row_data.failed_attempts, updated_at = now()
  where user_id = auth.uid();

  return jsonb_build_object('ok', false, 'reason', 'wrong_pin', 'remaining_attempts', remaining);
end;
$$;

revoke all on public.finance_security from anon, authenticated;
revoke all on function public.has_finance_pin() from public, anon;
revoke all on function public.set_finance_pin(text) from public, anon;
revoke all on function public.verify_finance_pin(text) from public, anon;
grant execute on function public.has_finance_pin() to authenticated;
grant execute on function public.set_finance_pin(text) to authenticated;
grant execute on function public.verify_finance_pin(text) to authenticated;
