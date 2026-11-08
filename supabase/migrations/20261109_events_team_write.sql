-- События календаря: участники тоже должны создавать мероприятия.
-- Раньше insert/update/delete были только для владельца — участник получал
-- "new row violates row-level security policy for table events" (код 42501).
-- Run AFTER supabase/migrations/20261108_events_starts_at.sql.

drop policy if exists events_owner_insert on public.events;
drop policy if exists events_owner_update on public.events;
drop policy if exists events_owner_delete on public.events;

-- Создавать события может активный владелец или участник
drop policy if exists events_team_insert on public.events;
create policy events_team_insert on public.events
  for insert to authenticated
  with check (public.current_team_role() in ('owner', 'member'));

-- Менять и удалять: владелец или автор события
drop policy if exists events_author_update on public.events;
create policy events_author_update on public.events
  for update to authenticated
  using (
    public.current_team_role() = 'owner'
    or (public.current_team_role() = 'member' and (owner_id = auth.uid() or created_by = auth.uid()))
  )
  with check (
    public.current_team_role() = 'owner'
    or (public.current_team_role() = 'member' and (owner_id = auth.uid() or created_by = auth.uid()))
  );

drop policy if exists events_author_delete on public.events;
create policy events_author_delete on public.events
  for delete to authenticated
  using (
    public.current_team_role() = 'owner'
    or (public.current_team_role() = 'member' and (owner_id = auth.uid() or created_by = auth.uid()))
  );

comment on policy events_team_insert on public.events is 'Создавать мероприятия могут владелец и участники';
