-- Team access/profile migration. Run in Supabase SQL Editor.
alter table public.members add column if not exists bio text not null default '';
alter table public.members add column if not exists avatar_url text not null default '';
alter table public.profiles add column if not exists bio text not null default '';
alter table public.profiles add column if not exists avatar_url text not null default '';

-- Let signed-in users see team account names for directory/assignee lists.
drop policy if exists profiles_team_read on public.profiles;
create policy profiles_team_read on public.profiles
  for select to authenticated using (true);

-- Remove direct UPDATE policies. Profile changes below go through narrow RPCs
-- so users cannot change their own role through ordinary PostgREST updates.
do $$
declare p record;
begin
  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'profiles' and cmd = 'UPDATE'
  loop
    execute format('drop policy if exists %I on public.profiles', p.policyname);
  end loop;
end $$;

-- Profile owners can edit only display fields through this RPC; they cannot
-- elevate their own role by sending an UPDATE on profiles.role.
create or replace function public.update_own_profile(
  new_full_name text,
  new_bio text,
  new_avatar_url text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  update public.profiles
     set full_name = coalesce(new_full_name, ''),
         bio = coalesce(new_bio, ''),
         avatar_url = coalesce(new_avatar_url, '')
   where id = auth.uid();
  if not found then raise exception 'Profile not found' using errcode = 'P0002'; end if;
end;
$$;
revoke all on function public.update_own_profile(text, text, text) from public;
grant execute on function public.update_own_profile(text, text, text) to authenticated;

-- Only an owner can change another account's role. Never expose service_role
-- in the browser. This function intentionally cannot create another owner.
create or replace function public.admin_set_profile_role(
  target_profile_id uuid,
  new_role text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner'
  ) then
    raise exception 'Only the owner can change account roles' using errcode = '42501';
  end if;
  if new_role not in ('member', 'viewer') then
    raise exception 'Allowed roles: member, viewer' using errcode = '22023';
  end if;
  if target_profile_id = auth.uid() then
    raise exception 'Owner cannot change their own role' using errcode = '42501';
  end if;
  update public.profiles set role = new_role where id = target_profile_id;
  if not found then raise exception 'Profile not found' using errcode = 'P0002'; end if;
end;
$$;
revoke all on function public.admin_set_profile_role(uuid, text) from public;
grant execute on function public.admin_set_profile_role(uuid, text) to authenticated;


-- Owner can edit another registered user's public profile (not role).
create or replace function public.admin_update_profile(
  target_profile_id uuid,
  new_full_name text,
  new_bio text,
  new_avatar_url text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'owner') then
    raise exception 'Only the owner can edit another profile' using errcode = '42501';
  end if;
  if target_profile_id = auth.uid() then
    raise exception 'Use the self profile editor' using errcode = '42501';
  end if;
  update public.profiles
     set full_name = coalesce(new_full_name, ''),
         bio = coalesce(new_bio, ''),
         avatar_url = coalesce(new_avatar_url, '')
   where id = target_profile_id;
  if not found then raise exception 'Profile not found' using errcode = 'P0002'; end if;
end;
$$;
revoke all on function public.admin_update_profile(uuid, text, text, text) from public;
grant execute on function public.admin_update_profile(uuid, text, text, text) to authenticated;

-- Existing profiles remain active. New invite-created profiles are inserted
-- by the service-role Edge Function with active access only after owner approval.
alter table public.profiles add column if not exists access_status text not null default 'active';
update public.profiles set access_status = 'active' where access_status is null or access_status = '';

create or replace function public.current_team_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case when p.access_status in ('active', 'invited') then p.role else null end
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;
revoke all on function public.current_team_role() from public;
grant execute on function public.current_team_role() to authenticated;

create or replace function public.admin_set_profile_access(
  target_profile_id uuid,
  new_access_status text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_team_role() <> 'owner' then
    raise exception 'Only an active owner can change access' using errcode = '42501';
  end if;
  if new_access_status not in ('active', 'revoked') then
    raise exception 'Allowed access states: active, revoked' using errcode = '22023';
  end if;
  if target_profile_id = auth.uid() then
    raise exception 'Owner cannot revoke their own access' using errcode = '42501';
  end if;
  update public.profiles set access_status = new_access_status where id = target_profile_id;
  if not found then raise exception 'Profile not found' using errcode = 'P0002'; end if;
end;
$$;
revoke all on function public.admin_set_profile_access(uuid, text) from public;
grant execute on function public.admin_set_profile_access(uuid, text) to authenticated;

-- Access matrix: all active team accounts may read shared workspace data;
-- only owner can write shared data; a member can create tasks and edit only
-- tasks assigned to their own profile. Viewers are read-only. Restrictive
-- policies are rebuilt here so older broad policies cannot silently grant
-- extra rights.
do $$
declare
  tbl text;
  pol record;
begin
  foreach tbl in array array['tasks','goals','projects','events','money','members','directions'] loop
    if to_regclass(format('public.%I', tbl)) is null then continue; end if;
    execute format('alter table public.%I enable row level security', tbl);
    for pol in select policyname from pg_policies
               where schemaname='public' and tablename=tbl
    loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, tbl);
    end loop;
    execute format('create policy %I on public.%I for select to authenticated using (public.current_team_role() in (''owner'',''member'',''viewer''))', tbl || '_team_read', tbl);
    if tbl = 'tasks' then
      -- A member may create a task for themselves or for a teammate; owner too.
      execute format('create policy %I on public.%I for insert to authenticated with check (public.current_team_role() in (''owner'',''member''))', tbl || '_team_insert', tbl);
      execute format('create policy %I on public.%I for update to authenticated using (public.current_team_role() = ''owner'' or (public.current_team_role() = ''member'' and owner_id = auth.uid())) with check (public.current_team_role() = ''owner'' or (public.current_team_role() = ''member'' and owner_id = auth.uid()))', tbl || '_task_edit', tbl);
      execute format('create policy %I on public.%I for delete to authenticated using (public.current_team_role() = ''owner'')', tbl || '_owner_delete', tbl);
    else
      execute format('create policy %I on public.%I for insert to authenticated with check (public.current_team_role() = ''owner'')', tbl || '_owner_insert', tbl);
      execute format('create policy %I on public.%I for update to authenticated using (public.current_team_role() = ''owner'') with check (public.current_team_role() = ''owner'')', tbl || '_owner_update', tbl);
      execute format('create policy %I on public.%I for delete to authenticated using (public.current_team_role() = ''owner'')', tbl || '_owner_delete', tbl);
    end if;
  end loop;
end $$;

-- Profile reads are visible to active users for the team directory. Profile
-- writes go only through owner-checked RPCs above.
alter table public.profiles enable row level security;
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='profiles'
  loop execute format('drop policy if exists %I on public.profiles', p.policyname); end loop;
end $$;
create policy profiles_team_read on public.profiles for select to authenticated
  using (public.current_team_role() in ('owner','member','viewer'));
revoke update on public.profiles from authenticated;

-- Allow service-role Edge Function to keep using privileged profile upserts.
comment on function public.admin_set_profile_access(uuid, text) is 'Owner-only member access revocation/reactivation';
-- profile avatar data URLs are kept small; use Supabase Storage for larger images.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_access_status_check' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_access_status_check
      check (access_status in ('active','invited','revoked')) not valid;
  end if;
end $$;
alter table public.profiles validate constraint profiles_access_status_check;
grant select on public.profiles to authenticated;

create or replace function public.admin_set_profile_role(
  target_profile_id uuid,
  new_role text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_team_role() <> 'owner' then
    raise exception 'Only an active owner can change account roles' using errcode = '42501';
  end if;
  if new_role not in ('member', 'viewer') then
    raise exception 'Allowed roles: member, viewer' using errcode = '22023';
  end if;
  if target_profile_id = auth.uid() then
    raise exception 'Owner cannot change their own role' using errcode = '42501';
  end if;
  update public.profiles set role = new_role where id = target_profile_id;
  if not found then raise exception 'Profile not found' using errcode = 'P0002'; end if;
end;
$$;
revoke all on function public.admin_set_profile_role(uuid, text) from public;
grant execute on function public.admin_set_profile_role(uuid, text) to authenticated;

-- Ensure the application's profile RPCs remain executable after grants are tightened.
grant execute on function public.update_own_profile(text, text, text) to authenticated;
grant execute on function public.admin_update_profile(uuid, text, text, text) to authenticated;
