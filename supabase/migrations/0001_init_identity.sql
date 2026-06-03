-- 0001_init_identity.sql
-- Feature 002-admin-auth — identity & tenancy foundation.
-- Creates the four tables that keep administrators and students separate
-- populations and establish the multi-tenant boundary. RLS policies are in 0002.

-- Tenants: the multi-tenant isolation boundary for student-scoped data.
create table if not exists public.tenants (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

-- Administrators: 1:1 with auth.users. The ONLY identities in auth.users in this
-- feature. role is constrained to 'admin' so a student can never land here.
create table if not exists public.admin_profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text not null unique,
  display_name text not null,
  role         text not null default 'admin' check (role = 'admin'),
  full_control boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Students: the learner roster — a SEPARATE population, not in auth.users.
-- Tenant-scoped; minimal here (full student/wave domain lands in a later feature).
create table if not exists public.students (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  student_code text not null,
  full_name    text not null,
  created_at   timestamptz not null default now(),
  unique (tenant_id, student_code)
);

-- Minimal audit of admin sign-in outcomes. Never stores a password; the failure
-- reason is for traceability only and is never returned to the client.
create table if not exists public.admin_auth_events (
  id         bigint generated always as identity primary key,
  email      text not null,
  outcome    text not null check (outcome in ('success', 'denied')),
  reason     text not null check (reason in ('ok', 'bad_credentials', 'not_admin')),
  created_at timestamptz not null default now()
);
