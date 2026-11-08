-- Банк на Яндекс.Диске: метаданные файлов + серверное хранилище токенов.
-- Run this AFTER supabase/migrations/20261108_icons.sql.
--
-- Файлы физически лежат в Яндекс.Диске. В базе — только карточка (путь, имя,
-- тип, размер, папка, кто загрузил, ссылка на превью). Никаких base64.
--
-- Токены Яндекс.Диска лежат в отдельной таблице yandex_tokens. У неё включён
-- RLS и НЕТ ни одной политики: клиент из браузера к ней не имеет доступа.
-- Читает и пишет только Edge Function под service_role.

create table if not exists public.bank_files (
  id uuid primary key default gen_random_uuid(),
  yandex_path text not null,
  name text not null,
  mime text not null default '',
  kind text not null default 'docs',
  size bigint not null default 0,
  folder text not null default '',
  uploaded_by uuid references public.profiles(id) on delete set null,
  owner_name text not null default '',
  preview_url text not null default '',
  created_at timestamptz not null default now()
);

create unique index if not exists bank_files_path_key on public.bank_files (yandex_path);
create index if not exists bank_files_kind_idx on public.bank_files (kind);
create index if not exists bank_files_folder_idx on public.bank_files (folder);

alter table public.bank_files enable row level security;

drop policy if exists bank_files_team_read on public.bank_files;
create policy bank_files_team_read on public.bank_files
  for select to authenticated
  using (public.current_team_role() in ('owner', 'member', 'viewer'));

drop policy if exists bank_files_team_insert on public.bank_files;
create policy bank_files_team_insert on public.bank_files
  for insert to authenticated
  with check (public.current_team_role() in ('owner', 'member'));

drop policy if exists bank_files_manage on public.bank_files;
create policy bank_files_manage on public.bank_files
  for update to authenticated
  using (public.current_team_role() = 'owner' or (public.current_team_role() = 'member' and uploaded_by = auth.uid()))
  with check (public.current_team_role() = 'owner' or (public.current_team_role() = 'member' and uploaded_by = auth.uid()));

drop policy if exists bank_files_delete_own on public.bank_files;
create policy bank_files_delete_own on public.bank_files
  for delete to authenticated
  using (public.current_team_role() = 'owner' or (public.current_team_role() = 'member' and uploaded_by = auth.uid()));

create table if not exists public.yandex_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text not null default '',
  refresh_token text not null default '',
  expires_at timestamptz,
  scope text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.yandex_tokens enable row level security;
-- Политик намеренно нет: доступ только у service_role внутри Edge Function.
revoke all on public.yandex_tokens from anon, authenticated;

comment on table public.bank_files is 'Метаданные файлов Банка. Сами файлы — в Яндекс.Диске.';
comment on table public.yandex_tokens is 'OAuth-токены Яндекс.Диска. Только для Edge Function, клиенту недоступны.';
