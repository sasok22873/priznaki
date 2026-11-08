-- Продвижение: каналы и снимки метрик.
-- Run this AFTER supabase/migrations/20261108_bank_yandex.sql.
--
-- Каналы — соцсети и стриминги группы (ссылки берём у владельца).
-- Снимки — цифры на конкретную дату: подписчики, просмотры, прослушивания.
-- Пока данные вносятся вручную; когда появятся ключи YouTube/VK — сюда же
-- будет писать Edge Function, схема не изменится.

create table if not exists public.promo_channels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  platform text not null default 'other',
  url text not null default '',
  handle text not null default '',
  icon text not null default '',
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists promo_channels_name_key on public.promo_channels (name);

create table if not exists public.promo_snapshots (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.promo_channels(id) on delete cascade,
  taken_on date not null default current_date,
  followers integer not null default 0,
  views bigint not null default 0,
  plays bigint not null default 0,
  likes integer not null default 0,
  comments integer not null default 0,
  notes text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists promo_snapshots_channel_day_key on public.promo_snapshots (channel_id, taken_on);
create index if not exists promo_snapshots_channel_idx on public.promo_snapshots (channel_id, taken_on desc);

alter table public.promo_channels enable row level security;
alter table public.promo_snapshots enable row level security;

drop policy if exists promo_channels_read on public.promo_channels;
create policy promo_channels_read on public.promo_channels
  for select to authenticated
  using (public.current_team_role() in ('owner', 'member', 'viewer'));

drop policy if exists promo_channels_write on public.promo_channels;
create policy promo_channels_write on public.promo_channels
  for all to authenticated
  using (public.current_team_role() = 'owner')
  with check (public.current_team_role() = 'owner');

drop policy if exists promo_snapshots_read on public.promo_snapshots;
create policy promo_snapshots_read on public.promo_snapshots
  for select to authenticated
  using (public.current_team_role() in ('owner', 'member', 'viewer'));

drop policy if exists promo_snapshots_insert on public.promo_snapshots;
create policy promo_snapshots_insert on public.promo_snapshots
  for insert to authenticated
  with check (public.current_team_role() in ('owner', 'member') and (created_by is null or created_by = auth.uid()));

drop policy if exists promo_snapshots_update on public.promo_snapshots;
create policy promo_snapshots_update on public.promo_snapshots
  for update to authenticated
  using (public.current_team_role() in ('owner', 'member'))
  with check (public.current_team_role() in ('owner', 'member'));

drop policy if exists promo_snapshots_delete on public.promo_snapshots;
create policy promo_snapshots_delete on public.promo_snapshots
  for delete to authenticated
  using (public.current_team_role() = 'owner' or (public.current_team_role() = 'member' and created_by = auth.uid()));

comment on table public.promo_channels is 'Каналы продвижения: соцсети и стриминги группы.';
comment on table public.promo_snapshots is 'Снимки метрик канала на дату (ручной ввод или API).';
