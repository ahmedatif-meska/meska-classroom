import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock the Upstash client with an in-memory store. `get`/`set`/`del` are shared
 * spies so each test can assert calls and override behavior (e.g. throw to simulate
 * an outage).
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
  // A class so `new Redis(...)` works; methods point at the shared spies above.
  Redis: class {
    get = get;
    set = set;
    del = del;
  },
}));

import { cached, invalidate } from "@/lib/cache/redis";

beforeEach(() => {
  vi.clearAllMocks();
  store.clear();
  process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "token";
});

describe("cached() — read-through (US2.1)", () => {
  it("cold miss: runs the loader, stores with a TTL, returns the value", async () => {
    const loader = vi.fn(async () => ["a", "b"]);
    const result = await cached("admin:instructors:list", loader);

    expect(result).toEqual(["a", "b"]);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(
      "admin:instructors:list",
      ["a", "b"],
      expect.objectContaining({ ex: 60 })
    );
  });

  it("warm hit: returns the stored value WITHOUT running the loader (parity)", async () => {
    store.set("admin:members:list", [{ id: 1 }]);
    const loader = vi.fn(async () => [{ id: 999 }]);
    const result = await cached("admin:members:list", loader);

    expect(result).toEqual([{ id: 1 }]);
    expect(loader).not.toHaveBeenCalled();
  });

  it("honours a custom TTL", async () => {
    await cached("admin:waves:list", async () => [], { ttlSeconds: 120 });
    expect(set).toHaveBeenCalledWith(
      "admin:waves:list",
      [],
      expect.objectContaining({ ex: 120 })
    );
  });
});

describe("cached() — graceful degradation (US2.3 / FR-011)", () => {
  it("falls back to the loader when Redis throws, without surfacing an error", async () => {
    get.mockRejectedValueOnce(new Error("redis down"));
    const loader = vi.fn(async () => "from-source");
    const result = await cached("admin:instructors:list", loader);

    expect(result).toBe("from-source");
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("is a pure pass-through when the Upstash env vars are absent", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const loader = vi.fn(async () => "source-only");
    const result = await cached("admin:members:list", loader);

    expect(result).toBe("source-only");
    expect(get).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });
});

describe("invalidate() (US2.3)", () => {
  it("deletes the given keys", async () => {
    store.set("admin:members:list", [1]);
    await invalidate("admin:members:list");
    expect(del).toHaveBeenCalledWith("admin:members:list");
    expect(store.has("admin:members:list")).toBe(false);
  });

  it("never throws when Redis fails", async () => {
    del.mockRejectedValueOnce(new Error("redis down"));
    await expect(invalidate("admin:members:list")).resolves.toBeUndefined();
  });

  it("no-ops when given no keys", async () => {
    await invalidate();
    expect(del).not.toHaveBeenCalled();
  });
});
