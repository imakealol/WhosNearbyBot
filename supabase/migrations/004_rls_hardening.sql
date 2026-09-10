-- 004_rls_hardening.sql
-- Locks down anon (client-side) writes: everything writable now goes through
-- the Worker using the service-role key. Anon keeps read-only access.
-- Idempotent.

-- Profiles: drop anon write policies, keep read.
drop policy if exists "Allow public insert on profiles" on public.profiles;
drop policy if exists "Allow public update on profiles" on public.profiles;
drop policy if exists "Allow public read on profiles" on public.profiles;
create policy "Allow public read on profiles" on public.profiles
  for select using (true);

-- Transactions: no anon writes (payment webhook writes via service role).
drop policy if exists "Allow public insert on transactions" on public.transactions;
drop policy if exists "Allow public select on transactions" on public.transactions;
create policy "Allow public select on transactions" on public.transactions
  for select using (true);

-- Flying messages / raffle state: enable RLS if the tables exist,
-- keep public read, remove anon writes.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='flying_messages') then
    alter table public.flying_messages enable row level security;
    drop policy if exists "Allow public read on flying_messages" on public.flying_messages;
    create policy "Allow public read on flying_messages" on public.flying_messages
      for select using (true);
    drop policy if exists "Allow public insert on flying_messages" on public.flying_messages;
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='raffle_state') then
    alter table public.raffle_state enable row level security;
    drop policy if exists "Allow public read on raffle_state" on public.raffle_state;
    create policy "Allow public read on raffle_state" on public.raffle_state
      for select using (true);
    drop policy if exists "Allow public insert on raffle_state" on public.raffle_state;
    drop policy if exists "Allow public update on raffle_state" on public.raffle_state;
  end if;
end $$;

-- Purchases: read-only for anon.
alter table public.purchases enable row level security;
drop policy if exists "Allow public select on purchases" on public.purchases;
create policy "Allow public select on purchases" on public.purchases
  for select using (true);

notify pgrst, 'reload schema';
