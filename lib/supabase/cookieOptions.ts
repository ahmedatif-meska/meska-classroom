/**
 * Persistent-session cookie handling (feature 007).
 *
 * `@supabase/ssr` writes the `sb-*` auth cookies WITHOUT an explicit max-age, so the
 * browser treats them as session cookies and drops them when the app is closed —
 * forcing the user to sign in again on reopen. We add a persistent max-age when a
 * cookie specifies neither `maxAge` nor `expires`, so the refresh token survives a
 * close. A cookie that already sets one is left untouched — notably sign-out removal
 * (which sets `maxAge: 0`) and any explicit Supabase expiry — so logout still works.
 */

/** ~30 days, in seconds — the persistent-session window. */
export const PERSISTENT_SESSION_MAX_AGE = 60 * 60 * 24 * 30;

type WritableCookieOptions = {
  maxAge?: number;
  expires?: Date | number;
  [key: string]: unknown;
};

export function withPersistentMaxAge(
  options?: WritableCookieOptions
): WritableCookieOptions {
  if (options && (options.maxAge !== undefined || options.expires !== undefined)) {
    return options;
  }
  return { ...options, maxAge: PERSISTENT_SESSION_MAX_AGE };
}
