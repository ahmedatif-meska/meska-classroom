import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Cross-wave denial for the cached student-dashboard read (Principle VI, NON-NEGOTIABLE).
 *
 * The student profile is cached under `studentKey(tenantId, userId, "profile")`. This
 * test proves that a Wave B request can never receive Wave A's cached entry, because the
 * audience-scoped key cannot collide. We drive the real `cached()` + `studentKey()`
 * against an in-memory Upstash mock.
 */
const store = new Map<string, unknown>();
const get = vi.fn(async (k: string) => (store.has(k) ? store.get(k) : null));
const set = vi.fn(async (k: string, v: unknown) => {
  store.set(k, v);
  return "OK";
});
const del = vi.fn(async (...keys: string[]) => {
  keys.forEach((k) => store.delete(k));
  return keys.length;
});

vi.mock("@upstash/redis", () => ({
  Redis: class {
    get = get;
    set = set;
    del = del;
  },
}));

import { cached } from "@/lib/cache/redis";
import { studentKey } from "@/lib/cache/keys";

beforeEach(() => {
  vi.clearAllMocks();
  store.clear();
  process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "token";
});

describe("cache isolation — cross-wave denial (Principle VI)", () => {
  const aliceA = { id: "row-A", full_name: "Alice (Wave A)" };
  const bobB = { id: "row-B", full_name: "Bob (Wave B)" };

  it("never serves Wave A's cached profile to a Wave B user", async () => {
    // Wave A user loads and populates the cache under their own key.
    const a = await cached(
      studentKey("wave-A", "user-A", "profile"),
      async () => aliceA
    );
    expect(a).toEqual(aliceA);

    // A Wave B user requests their dashboard. Their key differs, so it MUST miss
    // Wave A's entry and load Wave B's own data — never Alice's.
    const bLoader = vi.fn(async () => bobB);
    const b = await cached(studentKey("wave-B", "user-B", "profile"), bLoader);

    expect(b).toEqual(bobB);
    expect(b).not.toEqual(aliceA);
    expect(bLoader).toHaveBeenCalledTimes(1); // had to load — no false hit on A's entry
  });

  it("stores each wave's profile under a distinct key (no shared slot)", async () => {
    await cached(studentKey("wave-A", "user-A", "profile"), async () => aliceA);
    await cached(studentKey("wave-B", "user-B", "profile"), async () => bobB);

    expect(store.get("student:wave-A:user-A:profile")).toEqual(aliceA);
    expect(store.get("student:wave-B:user-B:profile")).toEqual(bobB);
    // Wave B's key is NOT holding Wave A's data.
    expect(store.get("student:wave-B:user-B:profile")).not.toEqual(aliceA);
  });

  it("re-serving Wave A's key returns A's data to A (hit), proving the key — not luck — gates it", async () => {
    await cached(studentKey("wave-A", "user-A", "profile"), async () => aliceA);
    const again = await cached(
      studentKey("wave-A", "user-A", "profile"),
      async () => {
        throw new Error("should not load on a hit");
      }
    );
    expect(again).toEqual(aliceA);
  });
});
