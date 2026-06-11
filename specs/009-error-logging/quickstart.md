# Quickstart: Error Logging (009)

## Prerequisites

- `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  (and `SUPABASE_SERVICE_ROLE_KEY` for the live integration tests).
- Migrations `0001`–`0011` applied, then apply `supabase/migrations/0012_error_logs.sql`
  (Supabase SQL editor, CLI, or the Supabase MCP `apply_migration`).
- A seeded admin (`npm run seed:admin`).

## Run

```bash
npm run dev
```

## See it work (golden path)

1. **Force a server-side failure**: temporarily break a wired call site (e.g. make the
   `students` insert in `createMember` target a bogus column) or revoke a grant in a
   scratch branch, then perform the action in the UI as an admin. You should see the
   **same friendly error message as before** — nothing user-visible changes.
2. **Verify the entry**: sign in as the admin → `/admin/errors`. The newest row shows
   the operation (`createMember`), severity `error`, surface `admin`, your admin user,
   and the moment it happened. Open the row → full message, stack, and redacted context.
3. **Verify anonymity handling**: trigger a failure on a signed-out flow (e.g. the
   student sign-in path) → the entry's user shows the anonymous label.
4. **Verify the safety net**: throw inside any server component under `/admin/**` →
   the standard error screen renders, and a `fatal` `onRequestError:…` entry appears.
5. **Verify isolation (Principle VI)**: as a student, attempt to read
   `error_logs` via the anon client / REST — zero rows. (Automated in
   `tests/integration/rls.test.ts`.)

## Tests

```bash
npm test                                        # full suite
npx vitest run tests/lib/errors/serialize.test.ts
npx vitest run tests/integration/rls.test.ts    # live; skips without creds
```

## Retention

Migration `0012` schedules a daily `pg_cron` purge of entries older than 90 days.
If `pg_cron` is unavailable in an environment, run the equivalent manually:

```sql
delete from public.error_logs where occurred_at < now() - interval '90 days';
```

## Notes

- Logging is failure-path-only; success paths are untouched.
- A logging failure never surfaces to users — check the server console
  (`console.error` fallback) if entries are missing.
- Secrets (passwords, tokens, cookies, file bytes) are structurally excluded: the
  context API only accepts caller-chosen scalars, a deny-list scrubs key names, and
  page paths are stored without query strings.
