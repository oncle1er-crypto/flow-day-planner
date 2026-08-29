alter table public.finance_security
  add column unlocked_until timestamptz;

create or replace function public.is_finance_unlocked()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.finance_security
    where user_id = auth.uid()
      and unlocked_until is not null
      and unlocked_until > now()
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

  if exists (select 1 from public.finance_security where user_id = auth.uid()) then
    raise exception 'Un code Finances est déjà configuré';
  end if;

  insert into public.finance_security(
    user_id,
    pin_hash,
    failed_attempts,
    locked_until,
    unlocked_until,
    updated_at
  )
  values (auth.uid(), crypt(new_pin, gen_salt('bf', 10)), 0, null, null, now());
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
    set failed_attempts = 0,
        locked_until = null,
        unlocked_until = now() + interval '10 minutes',
        updated_at = now()
    where user_id = auth.uid();
    return jsonb_build_object('ok', true, 'reason', 'verified', 'remaining_attempts', 5);
  end if;

  row_data.failed_attempts := coalesce(row_data.failed_attempts, 0) + 1;
  remaining := greatest(5 - row_data.failed_attempts, 0);

  if row_data.failed_attempts >= 5 then
    update public.finance_security
    set failed_attempts = 0,
        locked_until = now() + interval '15 minutes',
        unlocked_until = null,
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
  set failed_attempts = row_data.failed_attempts,
      unlocked_until = null,
      updated_at = now()
  where user_id = auth.uid();

  return jsonb_build_object('ok', false, 'reason', 'wrong_pin', 'remaining_attempts', remaining);
end;
$$;

create or replace function public.change_finance_pin(current_pin text, new_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  verification jsonb;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;

  if new_pin is null or new_pin !~ '^[0-9]{4}$' then
    raise exception 'Le nouveau code doit contenir exactement 4 chiffres';
  end if;

  verification := public.verify_finance_pin(current_pin);
  if coalesce((verification->>'ok')::boolean, false) is not true then
    if verification->>'reason' = 'locked' then
      raise exception 'Accès temporairement bloqué';
    end if;
    raise exception 'Code actuel incorrect';
  end if;

  update public.finance_security
  set pin_hash = crypt(new_pin, gen_salt('bf', 10)),
      failed_attempts = 0,
      locked_until = null,
      unlocked_until = null,
      updated_at = now()
  where user_id = auth.uid();
end;
$$;

create or replace function public.lock_finance()
returns void
language sql
security definer
set search_path = public
as $$
  update public.finance_security
  set unlocked_until = null,
      updated_at = now()
  where user_id = auth.uid();
$$;

drop policy if exists "Users manage own financial obligations" on public.financial_obligations;
create policy "Users manage unlocked financial obligations"
  on public.financial_obligations for all
  using (auth.uid() = user_id and public.is_finance_unlocked())
  with check (auth.uid() = user_id and public.is_finance_unlocked());

drop policy if exists "Users read own financial payments" on public.financial_payments;
drop policy if exists "Users create own financial payments" on public.financial_payments;
drop policy if exists "Users update own financial payments" on public.financial_payments;
drop policy if exists "Users delete own financial payments" on public.financial_payments;

create policy "Users read unlocked financial payments"
  on public.financial_payments for select
  using (auth.uid() = user_id and public.is_finance_unlocked());

create policy "Users create unlocked financial payments"
  on public.financial_payments for insert
  with check (
    auth.uid() = user_id
    and public.is_finance_unlocked()
    and exists (
      select 1 from public.financial_obligations o
      where o.id = obligation_id and o.user_id = auth.uid()
    )
  );

create policy "Users update unlocked financial payments"
  on public.financial_payments for update
  using (auth.uid() = user_id and public.is_finance_unlocked())
  with check (
    auth.uid() = user_id
    and public.is_finance_unlocked()
    and exists (
      select 1 from public.financial_obligations o
      where o.id = obligation_id and o.user_id = auth.uid()
    )
  );

create policy "Users delete unlocked financial payments"
  on public.financial_payments for delete
  using (auth.uid() = user_id and public.is_finance_unlocked());

create or replace function public.record_financial_payment(
  target_obligation_id uuid,
  payment_amount numeric,
  payment_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  obligation_row public.financial_obligations%rowtype;
  already_paid numeric(14,2);
  remaining numeric(14,2);
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;

  if not public.is_finance_unlocked() then
    raise exception 'Module Finances verrouillé';
  end if;

  if payment_amount is null or payment_amount <= 0 then
    raise exception 'Montant invalide';
  end if;

  select * into obligation_row
  from public.financial_obligations
  where id = target_obligation_id
    and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Opération introuvable';
  end if;

  if obligation_row.status <> 'open' then
    raise exception 'Cette opération n''est plus active';
  end if;

  select coalesce(sum(amount), 0)::numeric(14,2)
  into already_paid
  from public.financial_payments
  where obligation_id = obligation_row.id;

  remaining := greatest(obligation_row.original_amount - already_paid, 0)::numeric(14,2);

  if payment_amount > remaining then
    raise exception 'Le paiement dépasse le solde restant';
  end if;

  insert into public.financial_payments(obligation_id, user_id, amount, note)
  values (obligation_row.id, auth.uid(), payment_amount, nullif(trim(payment_note), ''));

  if payment_amount = remaining then
    update public.financial_obligations
    set status = 'settled', settled_at = now()
    where id = obligation_row.id;
  end if;
end;
$$;

revoke all on function public.is_finance_unlocked() from public, anon;
revoke all on function public.change_finance_pin(text, text) from public, anon;
revoke all on function public.lock_finance() from public, anon;
revoke all on function public.record_financial_payment(uuid, numeric, text) from public, anon;
grant execute on function public.is_finance_unlocked() to authenticated;
grant execute on function public.change_finance_pin(text, text) to authenticated;
grant execute on function public.lock_finance() to authenticated;
grant execute on function public.record_financial_payment(uuid, numeric, text) to authenticated;
