/**
 * Pure helpers for keeping a member's JWT wave claim in sync with their account
 * record. Kept free of Supabase/Next imports so the guarantees are
 * deterministically unit-testable — mirrors the other `lib/auth/*` gates.
 *
 * Why: RLS reads the wave from the ACCESS TOKEN claim (`jwt_tenant_id()`), but an
 * admin can reassign a member's wave while the member holds a still-valid token
 * carrying the old claim — for up to the token lifetime the member would see no
 * wave data. The proxy compares the token claim against the fresh Auth-server
 * record (from `getUser()`) and forces a session refresh when they diverge, so a
 * reassignment is visible on the member's very next request.
 */

/**
 * Extract `app_metadata.tenant_id` from a raw JWT access token. Returns null for
 * a missing/malformed token or an absent claim — never throws.
 */
export function jwtTenantClaim(
  accessToken: string | null | undefined
): string | null {
  if (!accessToken) return null;
  const parts = accessToken.split(".");
  if (parts.length !== 3) return null;
  try {
    // base64url → base64 (+ padding). The claim is an ASCII uuid, so atob-based
    // decoding is lossless for everything we read.
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const payload: unknown = JSON.parse(atob(padded));
    const tenant = (payload as { app_metadata?: { tenant_id?: unknown } })
      ?.app_metadata?.tenant_id;
    return typeof tenant === "string" && tenant ? tenant : null;
  } catch {
    return null;
  }
}

/** True when the token's wave claim no longer matches the account record's wave. */
export function tenantClaimIsStale(
  accessToken: string | null | undefined,
  recordTenantId: unknown
): boolean {
  const record =
    typeof recordTenantId === "string" && recordTenantId
      ? recordTenantId
      : null;
  return jwtTenantClaim(accessToken) !== record;
}
