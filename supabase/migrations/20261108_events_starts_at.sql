-- События: приложение пишет только date/time, а starts_at был обязательным без значения.
-- Делаем starts_at необязательным и заполняем его триггером из date/time (Asia/Krasnoyarsk, UTC+7).
-- Run this AFTER supabase/migrations/20261108_calendar.sql.

alter table public.events alter column starts_at drop not null;

create or replace function public.events_fill_starts_at()
returns trigger
language plpgsql
as $$
begin
  if new.starts_at is null and new.date is not null then
    new.starts_at := (new.date::text || ' ' || coalesce(nullif(new.time, ''), '00:00'))::timestamp
      at time zone 'Asia/Krasnoyarsk';
  end if;
  if new.date is null and new.starts_at is not null then
    new.date := (new.starts_at at time zone 'Asia/Krasnoyarsk')::date;
    if coalesce(new.time, '') = '' then
      new.time := to_char(new.starts_at at time zone 'Asia/Krasnoyarsk', 'HH24:MI');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists events_fill_starts_at_trg on public.events;
create trigger events_fill_starts_at_trg
  before insert or update on public.events
  for each row execute function public.events_fill_starts_at();

comment on function public.events_fill_starts_at() is 'Заполняет starts_at из date/time и наоборот, чтобы события из приложения корректно попадали в календарь.';
