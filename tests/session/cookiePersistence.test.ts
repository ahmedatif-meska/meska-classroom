import { describe, it, expect } from "vitest";
import {
  withPersistentMaxAge,
  PERSISTENT_SESSION_MAX_AGE,
} from "@/lib/supabase/cookieOptions";

/**
 * US1 — persistent sessions. Auth cookies must be written with a persistent max-age
 * so they survive an app close (no re-login on reopen), WITHOUT overriding an
 * explicit expiry such as the sign-out removal (maxAge: 0).
 */
describe("withPersistentMaxAge (US1 — persistent sessions)", () => {
  it("adds a persistent max-age when the cookie has neither maxAge nor expires", () => {
    expect(withPersistentMaxAge({ httpOnly: true })).toEqual({
      httpOnly: true,
      maxAge: PERSISTENT_SESSION_MAX_AGE,
    });
  });

  it("adds a persistent max-age when options is undefined", () => {
    expect(withPersistentMaxAge()).toEqual({
      maxAge: PERSISTENT_SESSION_MAX_AGE,
    });
  });

  it("preserves an explicit maxAge of 0 (sign-out removal) — logout must still clear the cookie", () => {
    expect(withPersistentMaxAge({ maxAge: 0 })).toEqual({ maxAge: 0 });
  });

  it("preserves a Supabase-supplied maxAge", () => {
    expect(withPersistentMaxAge({ maxAge: 3600 })).toEqual({ maxAge: 3600 });
  });

  it("preserves an explicit expires", () => {
    const expires = new Date("2030-01-01T00:00:00Z");
    expect(withPersistentMaxAge({ expires })).toEqual({ expires });
  });

  it("uses a far-future window (≈30 days), not a short-lived session", () => {
    expect(PERSISTENT_SESSION_MAX_AGE).toBeGreaterThanOrEqual(60 * 60 * 24 * 7);
  });
});
