/**
 * Audience-scoped cache keys (feature 007) — the single source of truth for every
 * cache key. A key MUST encode every dimension that decides who may see the value, so
 * a cached entry can only ever be served to a request whose key is byte-identical.
 * This is what keeps wave isolation intact (constitution Principle VI): a Wave A
 * student key can never match a Wave B request.
 *
 * Pure (no I/O) so the isolation rules are deterministically unit-testable — mirrors
 * the `lib/auth/*` pattern.
 */

/** Admin reads are admin-scoped and global (the admin role sees all tenants by design). */
export function adminListKey(
  resource: "instructors" | "members" | "waves"
): string {
  return `admin:${resource}:list`;
}

/**
 * Student reads are scoped to BOTH the wave (tenant) and the individual user. Both ids
 * are mandatory: a key that dropped either dimension could leak across waves/users, so
 * we refuse to build one (the caller must then skip caching).
 */
export function studentKey(
  tenantId: string,
  userId: string,
  resource: "profile"
): string {
  if (!tenantId || !userId) {
    throw new Error(
      "studentKey requires both tenantId and userId (wave-isolation invariant)"
    );
  }
  return `student:${tenantId}:${userId}:${resource}`;
}
