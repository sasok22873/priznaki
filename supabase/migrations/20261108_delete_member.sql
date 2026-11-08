-- Удаление аккаунта участника из панели владельца.
-- Run this AFTER supabase/migrations/20261108_team_approval.sql.
--
-- Удаляется именно аккаунт входа (auth.users), а профиль удаляется каскадом.
-- Задачи, проекты и прочие записи, где человек был ответственным, остаются:
-- внешние ключи обнуляют ссылку (ON DELETE SET NULL), а имя в owner_name
-- сохраняется как история.
--
-- Защита:
--   * только активный владелец;
--   * нельзя удалить самого себя;
--   * нельзя удалить аккаунт с ролью owner.

create or replace function public.admin_delete_profile(
  target_profile_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_team_role() is distinct from 'owner' then
    raise exception 'Only an active owner can delete accounts' using errcode = '42501';
  end if;
  if target_profile_id = auth.uid() then
    raise exception 'Owner cannot delete their own account' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = target_profile_id and role = 'owner') then
    raise exception 'Owner accounts cannot be deleted from this panel' using errcode = '42501';
  end if;

  -- Основной путь: удаляем аккаунт входа, профиль уходит каскадом
  -- (profiles_id_fkey ... ON DELETE CASCADE).
  delete from auth.users where id = target_profile_id;
  if found then
    return;
  end if;

  -- Резервный путь: аккаунта входа уже нет, но профиль остался.
  delete from public.profiles where id = target_profile_id;
  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.admin_delete_profile(uuid) from public;
grant execute on function public.admin_delete_profile(uuid) to authenticated;

comment on function public.admin_delete_profile(uuid) is
  'Owner-only permanent deletion of a team account (auth user + profile).';
