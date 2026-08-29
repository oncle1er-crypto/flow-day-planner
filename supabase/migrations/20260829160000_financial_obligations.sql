create type public.financial_obligation_type as enum ('receivable', 'debt');
create type public.financial_obligation_status as enum ('open', 'settled', 'cancelled');

create table public.financial_obligations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.financial_obligation_type not null,
  counterparty_name text not null check (length(trim(counterparty_name)) > 0),
  counterparty_phone text,
  title text not null check (length(trim(title)) > 0),
  notes text,
  currency text not null default 'XOF' check (currency ~ '^[A-Z]{3}$'),
  original_amount numeric(14,2) not null check (original_amount > 0),
  due_date date,
  status public.financial_obligation_status not null default 'open',
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.financial_payments (
  id uuid primary key default gen_random_uuid(),
  obligation_id uuid not null references public.financial_obligations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  paid_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now()
);

create index financial_obligations_user_type_due_idx
  on public.financial_obligations(user_id, type, due_date);
create index financial_payments_obligation_paid_idx
  on public.financial_payments(obligation_id, paid_at desc);

alter table public.financial_obligations enable row level security;
alter table public.financial_payments enable row level security;

create policy "Users manage own financial obligations"
  on public.financial_obligations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users read own financial payments"
  on public.financial_payments for select
  using (auth.uid() = user_id);

create policy "Users create own financial payments"
  on public.financial_payments for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.financial_obligations o
      where o.id = obligation_id and o.user_id = auth.uid()
    )
  );

create policy "Users update own financial payments"
  on public.financial_payments for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.financial_obligations o
      where o.id = obligation_id and o.user_id = auth.uid()
    )
  );

create policy "Users delete own financial payments"
  on public.financial_payments for delete
  using (auth.uid() = user_id);

create or replace function public.set_financial_obligation_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_financial_obligation_updated_at
before update on public.financial_obligations
for each row execute function public.set_financial_obligation_updated_at();

create or replace view public.financial_obligation_balances
with (security_invoker = true)
as
select
  o.*,
  coalesce(sum(p.amount), 0)::numeric(14,2) as paid_amount,
  greatest(o.original_amount - coalesce(sum(p.amount), 0), 0)::numeric(14,2) as remaining_amount,
  (o.status = 'open' and o.due_date is not null and o.due_date < current_date
    and o.original_amount > coalesce(sum(p.amount), 0)) as is_overdue
from public.financial_obligations o
left join public.financial_payments p on p.obligation_id = o.id
group by o.id;

grant select on public.financial_obligation_balances to authenticated;
