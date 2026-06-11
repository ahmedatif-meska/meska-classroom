-- 0013_member_reassigned_audit
-- Widen the audit reason CHECK to admit wave reassignment (an admin assigning an
-- unassigned member to a wave) alongside the existing sign-in (002), recovery (003),
-- admin-management (004), and member lifecycle (006/007) reasons. Additive + idempotent.
alter table public.admin_auth_events
  drop constraint if exists admin_auth_events_reason_check;

alter table public.admin_auth_events
  add constraint admin_auth_events_reason_check
  check (reason in (
    'ok', 'bad_credentials', 'not_admin',
    'reset_requested', 'reset_done', 'reset_invalid',
    'admin_created', 'admin_removed', 'admin_reinvited',
    'member_created', 'member_reinvited', 'member_removed', 'member_reassigned'
  ));
