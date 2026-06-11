-- 0016_wave_videos.sql
-- Feature 011-video-resources — attach admin-provided Google Drive videos to a
-- wave's week, played inline by enrolled students. Modeled on wave_materials
-- (0008): a child table that denormalizes tenant_id so the student read policy is
-- the flat `tenant_id = jwt_tenant_id()` (no joins), wave-isolated at the row level
-- (constitution Principle VI).
--
-- Unlike materials, the payload is a Google Drive FILE ID (text), not uploaded
-- file bytes — the admin hosts the video on Drive and shares a link. So there is
-- NO Storage bucket here. Helpers is_admin() / jwt_tenant_id() are from 0002.

create table if not exists public.wave_videos (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id)    on delete cascade,
  week_id       uuid not null references public.wave_weeks (id) on delete cascade,
  title         text not null,
  drive_file_id text not null,
  position      int  not null default 1,
  created_at    timestamptz not null default now()
);

create index if not exists wave_videos_week_idx
  on public.wave_videos (week_id);
create index if not exists wave_videos_tenant_position_idx
  on public.wave_videos (tenant_id, position);

-- RLS — the wave-isolation boundary (Principle VI). Admin sees all + writes; a
-- student sees only its own wave's videos and never writes (authoring is admin-only).
alter table public.wave_videos enable row level security;

drop policy if exists wave_videos_select on public.wave_videos;
create policy wave_videos_select on public.wave_videos
  for select using (public.is_admin() or tenant_id = public.jwt_tenant_id());

drop policy if exists wave_videos_write on public.wave_videos;
create policy wave_videos_write on public.wave_videos
  for all using (public.is_admin()) with check (public.is_admin());
