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

revoke all on function public.record_financial_payment(uuid, numeric, text) from public;
grant execute on function public.record_financial_payment(uuid, numeric, text) to authenticated;
