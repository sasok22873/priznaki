-- Карточки файлов Банка: заметка и иконка.
-- Run this AFTER supabase/migrations/20261108_bank_folders.sql.

alter table public.bank_files add column if not exists note text not null default '';
alter table public.bank_files add column if not exists icon text not null default '';

comment on column public.bank_files.note is 'Заметка к файлу (видна команде)';
comment on column public.bank_files.icon is 'Иконка карточки из набора icons.js';
