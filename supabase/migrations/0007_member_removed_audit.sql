-- 0007_member_removed_audit
-- Widen the audit reason CHECK to admit member removal alongside the existing
-- sign-in (002), recovery (003), admin-management (004), and member-provisioning
-- (006) reasons. Additive + idempotent.
alter table public.admin_auth_events
  drop constraint if exists admin_auth_events_reason_check;

alter table public.admin_auth_events
  add constraint admin_auth_events_reason_check
  check (reason in (
    'ok', 'bad_credentials', 'not_admin',
    'reset_requested', 'reset_done', 'reset_invalid',
    'admin_created', 'admin_removed', 'admin_reinvited',
    'member_created', 'member_reinvited', 'member_removed'
  ));
