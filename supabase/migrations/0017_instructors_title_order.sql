-- 0017_instructors_title_order.sql
-- Feature: instructors get a (mandatory, app-enforced) job TITLE shown under the
-- name, and an explicit display ORDER the admin controls by drag/reorder. The new
-- instructor appears at the bottom and the order is reflected in the student Home.
--
-- `title` is nullable at the DB level (existing rows have none); the create/update
-- actions enforce it as required going forward. `position` drives ordering
-- (ascending); existing rows are backfilled by creation time so the directory has
-- a stable initial order.

alter table public.instructors add column if not exists title text;
alter table public.instructors add column if not exists position int not null default 0;

-- Backfill a stable order for existing rows (oldest first → 1..N).
with ordered as (
  select id, row_number() over (order by created_at asc, id asc) as rn
  from public.instructors
)
update public.instructors i
  set position = ordered.rn
  from ordered
  where i.id = ordered.id;

create index if not exists instructors_position_idx
  on public.instructors (position);
