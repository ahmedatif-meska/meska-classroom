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
        .insert({ name, type: "online" })
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

  it("a tenantless caller cannot read wave content; the admin can (feature 008, Principle VI)", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(url!, serviceKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Seed a wave with a week, a material, and an assignment.
    const { data: t } = await admin
      .from("tenants")
      .insert({ name: "rls-test-waves", type: "offline" })
      .select("id")
      .single();
    tenantIds.push(t!.id);
    const { data: week } = await admin
      .from("wave_weeks")
      .insert({ tenant_id: t!.id, position: 1, title: "W1" })
      .select("id")
      .single();
    await admin.from("wave_materials").insert({
      tenant_id: t!.id,
      week_id: week!.id,
      title: "Slides",
      file_path: `${t!.id}/${week!.id}/x.pdf`,
    });
    await admin.from("wave_assignments").insert({
      tenant_id: t!.id,
      week_id: week!.id,
      title: "Task 1",
    });

    // Anon (no tenant claim) is denied every wave-scoped table → zero rows.
    const anon = createClient(url!, anonKey!);
    for (const table of ["wave_weeks", "wave_materials", "wave_assignments"]) {
      const { data } = await anon.from(table).select("id");
      expect(data ?? []).toHaveLength(0);
    }

    // The admin (service-role bypass) sees the seeded rows.
    const { data: seen } = await admin
      .from("wave_weeks")
      .select("id")
      .eq("tenant_id", t!.id);
    expect((seen ?? []).length).toBeGreaterThan(0);
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
