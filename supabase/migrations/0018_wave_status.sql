-- 0018_wave_status.sql
-- A wave (tenant) gets an admin-controlled lifecycle STATUS shown as a colored
-- tag on each card in the Waves list and filterable there. Status is set manually
-- by the admin in the wave create/edit builder (it is not derived from dates).
--
-- Allowed values: 'not_started' | 'in_progress' | 'completed'. Existing rows
-- default to 'not_started'. The column is NOT NULL with a default so every row
-- has a deterministic status.

alter table public.tenants
  add column if not exists status text not null default 'not_started';

alter table public.tenants
  drop constraint if exists tenants_status_check;
alter table public.tenants
  add constraint tenants_status_check
  check (status in ('not_started', 'in_progress', 'completed'));
