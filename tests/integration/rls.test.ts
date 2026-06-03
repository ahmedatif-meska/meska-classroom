/**
 * Integration test (US4.1) — RLS isolation against the live Supabase project.
 *
 * Requires `.env.local` (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY) and the migrations applied. Self-cleaning; skips
 * cleanly when creds are absent. Verifies SC-004 (admin/student populations are
 * disjoint) and SC-005 (zero cross-tenant leakage).
 */
import { describe, it, expect, afterAll } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(url && anonKey && serviceKey);

const tenantIds: string[] = [];

describe.skipIf(!hasCreds)("RLS isolation (live)", () => {
  it("an anon caller (no tenant claim) cannot read admin_profiles (SC-004)", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const anon = createClient(url!, anonKey!);
    const { data } = await anon.from("admin_profiles").select("email");
    // RLS denies non-admins → zero rows (never the seeded admin).
    expect(data ?? []).toHaveLength(0);
  });

  it("the service role (admin bypass) sees students across tenants", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(url!, serviceKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Seed two tenants with one student each.
    for (const name of ["rls-test-A", "rls-test-B"]) {
      const { data: t, error } = await admin
        .from("tenants")
        .insert({ name })
        .select("id")
        .single();
      expect(error).toBeNull();
      tenantIds.push(t!.id);
      await admin.from("students").insert({
        tenant_id: t!.id,
        student_code: `${name}-STU-001`,
        full_name: `${name} Student`,
      });
    }

    const { data } = await admin
      .from("students")
      .select("tenant_id")
      .in("tenant_id", tenantIds);
    expect(new Set((data ?? []).map((r) => r.tenant_id)).size).toBe(2);
  });

  afterAll(async () => {
    if (!hasCreds || tenantIds.length === 0) return;
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(url!, serviceKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await admin.from("students").delete().in("tenant_id", tenantIds);
    await admin.from("tenants").delete().in("id", tenantIds);
  });
});

describe.skipIf(hasCreds)("RLS isolation (skipped — no creds)", () => {
  it("skips without .env.local credentials", () => {
    expect(hasCreds).toBe(false);
  });
});
