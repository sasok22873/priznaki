-- Мозговой штурм: сессии, идеи, голоса, превращение идей в сущности.
-- Run AFTER supabase/migrations/20261109_team_content_writes.sql.

create table if not exists public.brainstorm_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  topic text not null default '',
  stage text not null default 'storm',
  status text not null default 'active',
  template text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.brainstorm_ideas (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.brainstorm_sessions(id) on delete cascade,
  text text not null,
  note text not null default '',
  author_id uuid references auth.users(id) on delete set null,
  author_name text not null default '',
  status text not null default 'new',
  target_type text not null default '',
  target_id uuid,
  target_title text not null default '',
  impact int not null default 0,
  confidence int not null default 0,
  ease int not null default 0,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brainstorm_votes (
  idea_id uuid not null references public.brainstorm_ideas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (idea_id, user_id)
);

create index if not exists brainstorm_ideas_session_idx on public.brainstorm_ideas (session_id, order_index);
create index if not exists brainstorm_votes_idea_idx on public.brainstorm_votes (idea_id);

alter table public.brainstorm_sessions enable row level security;
alter table public.brainstorm_ideas enable row level security;
alter table public.brainstorm_votes enable row level security;

-- чтение: вся активная команда
drop policy if exists brainstorm_sessions_read on public.brainstorm_sessions;
create policy brainstorm_sessions_read on public.brainstorm_sessions
  for select to authenticated
  using (public.current_team_role() in ('owner', 'member', 'viewer'));

-- создавать/менять сессии могут владелец и участник (наблюдатели — только смотрят)
drop policy if exists brainstorm_sessions_insert on public.brainstorm_sessions;
create policy brainstorm_sessions_insert on public.brainstorm_sessions
  for insert to authenticated
  with check (public.current_team_role() in ('owner', 'member'));

drop policy if exists brainstorm_sessions_update on public.brainstorm_sessions;
create policy brainstorm_sessions_update on public.brainstorm_sessions
  for update to authenticated
  using (public.current_team_role() in ('owner', 'member'))
  with check (public.current_team_role() in ('owner', 'member'));

drop policy if exists brainstorm_sessions_delete on public.brainstorm_sessions;
create policy brainstorm_sessions_delete on public.brainstorm_sessions
  for delete to authenticated
  using (public.current_team_role() in ('owner', 'member'));

drop policy if exists brainstorm_ideas_read on public.brainstorm_ideas;
create policy brainstorm_ideas_read on public.brainstorm_ideas
  for select to authenticated
  using (public.current_team_role() in ('owner', 'member', 'viewer'));

drop policy if exists brainstorm_ideas_insert on public.brainstorm_ideas;
create policy brainstorm_ideas_insert on public.brainstorm_ideas
  for insert to authenticated
  with check (public.current_team_role() in ('owner', 'member'));

drop policy if exists brainstorm_ideas_update on public.brainstorm_ideas;
create policy brainstorm_ideas_update on public.brainstorm_ideas
  for update to authenticated
  using (public.current_team_role() in ('owner', 'member'))
  with check (public.current_team_role() in ('owner', 'member'));

drop policy if exists brainstorm_ideas_delete on public.brainstorm_ideas;
create policy brainstorm_ideas_delete on public.brainstorm_ideas
  for delete to authenticated
  using (public.current_team_role() in ('owner', 'member'));

drop policy if exists brainstorm_votes_read on public.brainstorm_votes;
create policy brainstorm_votes_read on public.brainstorm_votes
  for select to authenticated
  using (public.current_team_role() in ('owner', 'member', 'viewer'));

drop policy if exists brainstorm_votes_insert on public.brainstorm_votes;
create policy brainstorm_votes_insert on public.brainstorm_votes
  for insert to authenticated
  with check (public.current_team_role() in ('owner', 'member') and user_id = auth.uid());

drop policy if exists brainstorm_votes_delete on public.brainstorm_votes;
create policy brainstorm_votes_delete on public.brainstorm_votes
  for delete to authenticated
  using (public.current_team_role() in ('owner', 'member') and user_id = auth.uid());

comment on table public.brainstorm_sessions is 'Сессии мозгового штурма';
comment on table public.brainstorm_ideas is 'Идеи внутри сессии; status: new|accepted|rejected|converted';
comment on table public.brainstorm_votes is 'Голоса +1 за идею (один на участника)';
