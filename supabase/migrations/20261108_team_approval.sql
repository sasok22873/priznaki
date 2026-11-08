-- Run this AFTER team-access-migration.sql in Supabase SQL Editor.
-- Existing accounts remain active; newly-created profiles are pending by default.

alter table public.profiles add column if not exists email text not null default '';
alter table public.profiles add column if not exists access_status text not null default 'active';
update public.profiles set access_status = 'active' where access_status is null or access_status = '';
alter table public.profiles alter column access_status set default 'invited';
alter table public.profiles alter column role set default 'member';

-- Only active users have an application role. Pending/revoked users have none.
create or replace function public.current_team_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case when p.access_status = 'active' then p.role else null end
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;
revoke all on function public.current_team_role() from public;
grant execute on function public.current_team_role() to authenticated;

-- An invited/revoked account can only read its own status. Active team accounts
-- can read the directory; no profile role changes are allowed by direct UPDATE.
alter table public.profiles enable row level security;
drop policy if exists profiles_team_read on public.profiles;
create policy profiles_team_read on public.profiles
for select to authenticated
using (id = auth.uid() or public.current_team_role() in ('owner','member','viewer'));
grant select on public.profiles to authenticated;
revoke update on public.profiles from authenticated;

create or replace function public.admin_set_profile_access(
  target_profile_id uuid,
  new_access_status text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_team_role() is distinct from 'owner' then
    raise exception 'Only an active owner can change access' using errcode = '42501';
  end if;
  if new_access_status not in ('active', 'revoked') then
    raise exception 'Allowed access states: active, revoked' using errcode = '22023';
  end if;
  if target_profile_id = auth.uid() then
    raise exception 'Owner cannot change their own access' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = target_profile_id and role = 'owner') then
    raise exception 'Owner accounts cannot be deactivated from this panel' using errcode = '42501';
  end if;
  update public.profiles set access_status = new_access_status where id = target_profile_id;
  if not found then raise exception 'Profile not found' using errcode = 'P0002'; end if;
end;
$$;
revoke all on function public.admin_set_profile_access(uuid, text) from public;
grant execute on function public.admin_set_profile_access(uuid, text) to authenticated;

create or replace function public.admin_set_profile_role(
  target_profile_id uuid,
  new_role text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_team_role() is distinct from 'owner' then
    raise exception 'Only an active owner can change account roles' using errcode = '42501';
  end if;
  if new_role not in ('member', 'viewer') then
    raise exception 'Allowed roles: member, viewer' using errcode = '22023';
  end if;
  if target_profile_id = auth.uid() then
    raise exception 'Owner cannot change their own role' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = target_profile_id and role = 'owner') then
    raise exception 'Owner accounts cannot be demoted from this panel' using errcode = '42501';
  end if;
  update public.profiles set role = new_role where id = target_profile_id;
  if not found then raise exception 'Profile not found' using errcode = 'P0002'; end if;
end;
$$;
revoke all on function public.admin_set_profile_role(uuid, text) from public;
grant execute on function public.admin_set_profile_role(uuid, text) to authenticated;

-- Narrow profile edits are exposed only through these owner/status-checked RPCs.
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
  if auth.uid() is null or public.current_team_role() is null then
    raise exception 'An active account is required' using errcode = '42501';
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
  if public.current_team_role() is distinct from 'owner' then
    raise exception 'Only an active owner can edit another profile' using errcode = '42501';
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
