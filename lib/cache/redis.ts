import { Redis } from "@upstash/redis";

/**
 * Guarded Upstash Redis read-cache (feature 007).
 *
 * SERVER-ONLY — never import into a Client Component. Backs read-heavy pages with an
 * audience-scoped cache (keys come from `lib/cache/keys.ts`). Two guarantees:
 *
 *  1. **Graceful degradation** — every call is wrapped so any Redis error, timeout, or
 *     missing config falls back to the source-of-truth loader and NEVER throws. A cache
 *     outage (or local dev with no Upstash env) is invisible: the app behaves as if the
 *     cache weren't there.
 *  2. **Bounded latency** — a short per-call timeout keeps a slow Redis off the critical
 *     path (no Core Web Vitals regression).
 *
 * The cache holds only already-authorized, non-secret read results and is safe to flush
 * at any time. It sits AFTER the page/action's auth gate — it never replaces authz.
 */

/** Per-call timeout so a slow Redis can't regress LCP/INP. */
const TIMEOUT_MS = 200;
/** Default freshness safety net; write-through invalidation is the primary mechanism. */
const DEFAULT_TTL_SECONDS = 60;

/**
 * A fresh lightweight HTTP client per call (Upstash REST is stateless — no pool to
 * reuse). Returns null when the env vars are absent, which makes every helper a
 * pass-through. Server-only: no `NEXT_PUBLIC_` prefix, like the service-role client.
 */
function getClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("redis timeout")), TIMEOUT_MS)
    ),
  ]);
}

/**
 * Read-through cache. On hit returns the stored value (parity with the loader); on miss
 * runs the loader, stores it under `key` with a TTL, and returns it. On ANY failure or
 * missing config, runs the loader and returns its result without throwing.
 */
export async function cached<T>(
  key: string,
  loader: () => Promise<T>,
  opts: { ttlSeconds?: number } = {}
): Promise<T> {
  const redis = getClient();
  if (!redis) return loader();

  try {
    const hit = await withTimeout(redis.get<T>(key));
    if (hit !== null && hit !== undefined) return hit;
  } catch {
    // Redis unavailable/slow — degrade to the source of truth.
    return loader();
  }

  const value = await loader();
  try {
    await withTimeout(
      redis.set(key, value, { ex: opts.ttlSeconds ?? DEFAULT_TTL_SECONDS })
    );
  } catch {
    // Best-effort population; a failed write just means the next read recomputes.
  }
  return value;
}

/** Best-effort invalidation. Deletes the given keys; never throws (TTL is the net). */
export async function invalidate(...keys: string[]): Promise<void> {
  const redis = getClient();
  if (!redis || keys.length === 0) return;
  try {
    await withTimeout(redis.del(...keys));
  } catch {
    // Ignore — the short TTL bounds any missed invalidation.
  }
}
