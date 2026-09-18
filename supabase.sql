create table if not exists public.flyband_saves (
  save_name text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.flyband_saves enable row level security;

drop policy if exists "flyband public read" on public.flyband_saves;
create policy "flyband public read" on public.flyband_saves for select to anon using (true);

drop policy if exists "flyband public insert" on public.flyband_saves;
create policy "flyband public insert" on public.flyband_saves for insert to anon with check (true);

drop policy if exists "flyband public update" on public.flyband_saves;
create policy "flyband public update" on public.flyband_saves for update to anon using (true) with check (true);
