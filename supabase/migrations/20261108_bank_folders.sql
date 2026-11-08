-- Иконки и подписи для папок Банка (папки физически живут в Яндекс.Диске).
-- Run this AFTER supabase/migrations/20261108_bank_yandex.sql.

create table if not exists public.bank_folders (
  yandex_path text primary key,
  name text not null default '',
  icon text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  owner_name text not null default '',
  created_at timestamptz not null default now()
);

alter table public.bank_folders enable row level security;

drop policy if exists bank_folders_read on public.bank_folders;
create policy bank_folders_read on public.bank_folders
  for select to authenticated
  using (public.current_team_role() in ('owner', 'member', 'viewer'));

drop policy if exists bank_folders_insert on public.bank_folders;
create policy bank_folders_insert on public.bank_folders
  for insert to authenticated
  with check (public.current_team_role() in ('owner', 'member') and (created_by is null or created_by = auth.uid()));

drop policy if exists bank_folders_update on public.bank_folders;
create policy bank_folders_update on public.bank_folders
  for update to authenticated
  using (public.current_team_role() = 'owner' or (public.current_team_role() = 'member' and created_by = auth.uid()))
  with check (public.current_team_role() = 'owner' or (public.current_team_role() = 'member' and created_by = auth.uid()));

drop policy if exists bank_folders_delete on public.bank_folders;
create policy bank_folders_delete on public.bank_folders
  for delete to authenticated
  using (public.current_team_role() = 'owner' or (public.current_team_role() = 'member' and created_by = auth.uid()));

comment on table public.bank_folders is 'Иконки и подписи папок Банка; сами папки — в Яндекс.Диске.';
