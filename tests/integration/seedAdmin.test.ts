/**
 * Integration test (US1.1) — runs against the live Supabase project.
 *
 * Requires `.env.local` with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * AND the migrations applied. Skips cleanly when creds are absent so the default
 * (offline) suite stays deterministic. Enable by exporting the env vars before
 * `npm test`, e.g. `node --env-file=.env.local node_modules/vitest/vitest.mjs run`.
 */
import { describe, it, expect } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(url && serviceKey);

describe.skipIf(!hasCreds)("seed-admin idempotency (live)", () => {
  it("yields exactly one admin profile with role=admin and full_control", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(url!, serviceKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await admin
      .from("admin_profiles")
      .select("email, role, full_control")
      .eq("email", "ahmedatif@meska.ai");

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].role).toBe("admin");
    expect(data![0].full_control).toBe(true);
  });
});

describe.skipIf(hasCreds)("seed-admin idempotency (skipped — no creds)", () => {
  it("skips without .env.local credentials", () => {
    expect(hasCreds).toBe(false);
  });
});
