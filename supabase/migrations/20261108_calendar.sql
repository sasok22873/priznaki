-- Подписка на календарь (ICS).
-- Run this AFTER supabase/migrations/20261108_bank_yandex.sql.
--
-- Одна персональная ссылка на пользователя. В таблице лежит только случайный
-- токен; по нему Edge Function calendar-feed собирает .ics с событиями группы
-- и задачами этого пользователя.
--
-- У таблицы включён RLS и НЕТ ни одной политики: из браузера к ней доступа нет.
-- Токен создаёт, меняет и удаляет только Edge Function под service_role.
-- Ссылка вида <SUPABASE_URL>/functions/v1/calendar-feed?token=... никому,
-- кроме владельца ссылки, не показывается.

create table if not exists public.calendar_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now()
);

alter table public.calendar_tokens enable row level security;

-- Политик намеренно нет: доступ только у service_role внутри Edge Function.
revoke all on public.calendar_tokens from anon, authenticated;

comment on table public.calendar_tokens is 'Токены подписки на календарь (ICS). Только для Edge Function, клиенту недоступны.';
comment on column public.calendar_tokens.user_id is 'Владелец ссылки: события группы + его личные задачи.';
comment on column public.calendar_tokens.token is 'Случайный токен в URL подписки (32 hex). Смена токена отключает старую ссылку.';
comment on column public.calendar_tokens.created_at is 'Когда ссылка была создана или последний раз обновлена.';
