-- Совместная работа: участники получают те же права на контент, что и владелец,
-- но деньги остаются у владельца. Автор записи всегда может править/удалять своё.
-- Run AFTER supabase/migrations/20261109_events_team_write.sql.

-- ---------- направления ----------
drop policy if exists directions_owner_insert on public.directions;
drop policy if exists directions_owner_update on public.directions;
drop policy if exists directions_owner_delete on public.directions;
create policy directions_team_insert on public.directions
  for insert to authenticated
  with check (public.current_team_role() in ('owner', 'member'));
create policy directions_team_update on public.directions
  for update to authenticated
  using (public.current_team_role() in ('owner', 'member'))
  with check (public.current_team_role() in ('owner', 'member'));
create policy directions_team_delete on public.directions
  for delete to authenticated
  using (public.current_team_role() in ('owner', 'member'));

-- ---------- цели ----------
drop policy if exists goals_owner_insert on public.goals;
drop policy if exists goals_owner_update on public.goals;
drop policy if exists goals_owner_delete on public.goals;
create policy goals_team_insert on public.goals
  for insert to authenticated
  with check (public.current_team_role() in ('owner', 'member'));
create policy goals_team_update on public.goals
  for update to authenticated
  using (public.current_team_role() in ('owner', 'member'))
  with check (public.current_team_role() in ('owner', 'member'));
create policy goals_team_delete on public.goals
  for delete to authenticated
  using (public.current_team_role() in ('owner', 'member'));

-- ---------- проекты ----------
drop policy if exists projects_owner_insert on public.projects;
drop policy if exists projects_owner_update on public.projects;
drop policy if exists projects_owner_delete on public.projects;
create policy projects_team_insert on public.projects
  for insert to authenticated
  with check (public.current_team_role() in ('owner', 'member'));
create policy projects_team_update on public.projects
  for update to authenticated
  using (public.current_team_role() in ('owner', 'member'))
  with check (public.current_team_role() in ('owner', 'member'));
create policy projects_team_delete on public.projects
  for delete to authenticated
  using (public.current_team_role() in ('owner', 'member'));

-- ---------- задачи: удалять может владелец или автор ----------
drop policy if exists tasks_owner_delete on public.tasks;
create policy tasks_author_delete on public.tasks
  for delete to authenticated
  using (
    public.current_team_role() = 'owner'
    or (public.current_team_role() = 'member' and (owner_id = auth.uid() or created_by = auth.uid()))
  );

-- money остаётся только у владельца (финансы) — интерфейс скрывает кнопки у участников.
