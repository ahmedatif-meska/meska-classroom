import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — bypasses Row-Level Security.
 *
 * SERVER-ONLY. Used exclusively by the seed script (scripts/seed-admin.ts), which
 * runs under Node (not the Next bundler). Protection against leaking to the client:
 * SUPABASE_SERVICE_ROLE_KEY has no NEXT_PUBLIC_ prefix (absent from the browser
 * bundle) and the guard below throws if it is ever missing. Never import this into
 * request/client code.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set (server-only).");
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
