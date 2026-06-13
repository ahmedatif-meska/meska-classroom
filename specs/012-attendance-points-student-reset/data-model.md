# Data Model: Student Password Reset, Attendance Tracking & Gamification Points

Three migrations (`0019`–`0021`). Helpers `is_admin()` / `jwt_tenant_id()` are from `0002`; the
`auth.uid()`→student-id subquery pattern is from `0008`.

---

## 0019 — `is_student_email(text)` (no table)

A `SECURITY DEFINER` boolean gate so the student forgot-password request can decide whether to
send a reset WITHOUT the service-role key (mirror of `is_admin_email`, 0003). No recovery tables —
Supabase Auth owns the single-use, time-limited token.

```sql
create or replace function public.is_student_email(p_email text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.students where lower(email) = lower(p_email)
  );
$$;

revoke all on function public.is_student_email(text) from public;
grant execute on function public.is_student_email(text) to anon, authenticated;
```

- Returns only a boolean → never exposes a student row.
- Matches ANY student row (pending or active) so a member who never set a password can still
  recover (R2). The non-enumerating action response means no information leaks regardless.

---

## 0020 — `public.wave_attendance`

One row == one student present on one calendar day. Tenant-scoped (Principle VI). The day uniqueness
is **global per student** (FR-028), so the unique key deliberately excludes `tenant_id`/`week_id`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid pk | `default gen_random_uuid()` |
| `tenant_id` | uuid not null | FK `tenants(id) on delete cascade` — the wave (denormalized for flat RLS) |
| `week_id` | uuid not null | FK `wave_weeks(id) on delete cascade` — the session's week |
| `student_id` | uuid not null | FK `students(id) on delete cascade` |
| `attended_on` | date not null | local day from `attendanceDay()` (R3) |
| `method` | text not null | `check (method in ('scan','csv'))` |
| `created_at` | timestamptz not null | `default now()` |

Constraints / indexes:
- `unique (student_id, attended_on)` — enforces one attendance per student per calendar day across
  ALL waves/weeks (FR-028). The action also pre-checks to return a friendly "already attended" instead
  of relying solely on the constraint error.
- `index (tenant_id, week_id)` and `index (student_id)` for the records table and the points count.

RLS (enable on the table):
```sql
-- admin: full access (record + view the table)
create policy wave_attendance_admin_all on public.wave_attendance
  for all using (public.is_admin()) with check (public.is_admin());

-- student: read ONLY their own rows in their own wave (drives their points count; cross-wave denied)
create policy wave_attendance_student_select on public.wave_attendance
  for select using (
    tenant_id = public.jwt_tenant_id()
    and student_id = (select id from public.students where user_id = auth.uid())
  );
```
- No student INSERT/UPDATE — attendance is admin-recorded only.
- **FR-027** (student must belong to the selected wave) is enforced in `markAttendance` BEFORE the
  insert (verify the student's `tenant_id` equals the chosen `waveId`), not by RLS alone, so the
  admin gets a clear rejection rather than a silent constraint behavior.

---

## 0021 — `public.point_rules` + `public.wave_feedback`

### `public.point_rules` — global reward config (no tenant)

| Column | Type | Notes |
|--------|------|-------|
| `action` | text pk | `check (action in ('attendance','assignment','feedback'))` |
| `points` | int not null | `check (points >= 0)` |
| `updated_at` | timestamptz not null | `default now()` |

Seed:
```sql
insert into public.point_rules (action, points) values
  ('attendance', 10), ('assignment', 20), ('feedback', 30)
  on conflict (action) do nothing;
```

RLS (global display/config data, instructors-table precedent — R7):
```sql
create policy point_rules_read on public.point_rules
  for select using (auth.role() = 'authenticated');   -- students read values to show their total
create policy point_rules_admin_write on public.point_rules
  for all using (public.is_admin()) with check (public.is_admin());
```
- Three fixed rows; `updatePointRule` UPDATEs `points` (and `updated_at`) for one `action`.

### `public.wave_feedback` — persisted per-week student feedback

Replaces the UI-only `WeekFeedback`. One row per student per week (so feedback points count once).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid pk | `default gen_random_uuid()` |
| `tenant_id` | uuid not null | FK `tenants(id) on delete cascade` (denormalized for flat RLS) |
| `week_id` | uuid not null | FK `wave_weeks(id) on delete cascade` |
| `student_id` | uuid not null | FK `students(id) on delete cascade` |
| `session_rating` | int | `check (session_rating between 1 and 5)`, nullable |
| `instructor_rating` | int | `check (instructor_rating between 1 and 5)`, nullable |
| `comment` | text | free text, bounded/sanitized for display |
| `created_at` | timestamptz not null | `default now()` |

Constraints / indexes:
- `unique (week_id, student_id)` — one feedback per student per week; `submitFeedback` upserts on it
  so a re-edit updates the row (no second points award).
- `index (student_id)` for the points count.

RLS (mirror `wave_submissions`, 0008):
```sql
create policy wave_feedback_admin_all on public.wave_feedback
  for all using (public.is_admin()) with check (public.is_admin());

create policy wave_feedback_student_select on public.wave_feedback
  for select using (
    tenant_id = public.jwt_tenant_id()
    and student_id = (select id from public.students where user_id = auth.uid())
  );
create policy wave_feedback_student_insert on public.wave_feedback
  for insert with check (
    tenant_id = public.jwt_tenant_id()
    and student_id = (select id from public.students where user_id = auth.uid())
  );
create policy wave_feedback_student_update on public.wave_feedback
  for update using (
    tenant_id = public.jwt_tenant_id()
    and student_id = (select id from public.students where user_id = auth.uid())
  ) with check (
    tenant_id = public.jwt_tenant_id()
    and student_id = (select id from public.students where user_id = auth.uid())
  );
```
- The `tenant_id = jwt_tenant_id()` check in the INSERT policy is the cross-wave denial: a student
  cannot write feedback for another wave's week (the week_id would belong to a different tenant).

---

## Derived points total (no stored column)

Computed on read in the student dashboard RSC; not persisted.

```
total = attendance_count        × rules.attendance
      + assignment_count        × rules.assignment   // submissions with submitted_at >= POINTS_EPOCH
      + feedback_count          × rules.feedback
```

- Counts are `select count(*) head:true` over the caller's own rows (RLS-bounded):
  `wave_attendance` (own), `wave_submissions` (own, `submitted_at >= POINTS_EPOCH`), `wave_feedback` (own).
- `rules` is the three `point_rules` values (one small read).
- `lib/points/total.ts#computeTotal(counts, rules)` is the pure multiplier-sum (unit-tested),
  including the zero-value case.
- New tables start empty + the assignment epoch ⇒ every student opens at zero (FR-022); editing a
  rule changes `rules` ⇒ totals recompute on next view, consistently for all students (FR-029).

## Validation rules (pure, unit-tested)

- **Attendance CSV** (`lib/attendance/csv.ts`): require a case-insensitive `email` header; one email
  per row; trim+lowercase; drop blanks; dedupe within the file; error on missing header or empty file.
- **Attendance day** (`lib/attendance/day.ts`): `attendanceDay(d)` → `YYYY-MM-DD` in `ATTENDANCE_TZ`.
- **Point rule value** (in `updatePointRule` / a small validator): non-negative integer; reject
  negative, blank, non-numeric, or fractional — keep prior value.
- **New password / email**: reuse `lib/auth/passwordReset.ts` (`validateEmailField`,
  `validateNewPassword`) unchanged for the student reset.
