-- Иконки для направлений, задач, целей и проектов.
-- Run this AFTER supabase/migrations/20261108_team_approval.sql.
-- Значение — имя иконки из набора window.PB_ICONS (icons.js); пустая строка = без иконки.

alter table public.directions add column if not exists icon text not null default '';
alter table public.tasks      add column if not exists icon text not null default '';
alter table public.goals      add column if not exists icon text not null default '';
alter table public.projects   add column if not exists icon text not null default '';

comment on column public.directions.icon is 'Icon name from the app icon set (icons.js)';
comment on column public.tasks.icon is 'Icon name from the app icon set (icons.js)';
comment on column public.goals.icon is 'Icon name from the app icon set (icons.js)';
comment on column public.projects.icon is 'Icon name from the app icon set (icons.js)';
