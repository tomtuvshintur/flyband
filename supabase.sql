-- FlyBand cloud save table
-- Paste this entire file into Supabase -> SQL Editor -> New query -> Run.

create table if not exists public.flyband_saves (
  save_name text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.flyband_saves enable row level security;

-- Hobby-project policy:
-- Anyone who knows your project's public anon key can read/write this table.
-- That is acceptable ONLY if the key is used for this private hobby project
-- and you do not store personal/private information in the save.
drop policy if exists "flyband public read" on public.flyband_saves;
create policy "flyband public read"
on public.flyband_saves
for select
to anon
using (true);

drop policy if exists "flyband public insert" on public.flyband_saves;
create policy "flyband public insert"
on public.flyband_saves
for insert
to anon
with check (true);

drop policy if exists "flyband public update" on public.flyband_saves;
create policy "flyband public update"
on public.flyband_saves
for update
to anon
using (true)
with check (true);
