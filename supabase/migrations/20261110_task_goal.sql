-- Задача может быть привязана к проекту и/или напрямую к цели.
-- В приложении эти связи хранятся текстом (как area/goal у проектов).
-- Run AFTER supabase/migrations/20261110_brainstorm.sql.

alter table public.tasks add column if not exists project text not null default '';
alter table public.tasks add column if not exists goal text not null default '';

comment on column public.tasks.project is 'Название проекта (текст, как в карточке задачи)';
comment on column public.tasks.goal is 'Название цели, к которой относится задача';
