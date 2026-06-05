/**
 * The app's public origin, used to build absolute URLs (member QR target, auth
 * email redirects). Single source of truth so deployments never leak a localhost
 * or relative URL into a QR / email link.
 *
 * Resolution order:
 *  1. NEXT_PUBLIC_SITE_URL — the explicit, configurable override (set this in
 *     `.env.local` for dev and on the host / `.env.production` for production).
 *  2. NEXT_PUBLIC_VERCEL_URL — Vercel's auto-injected per-deployment host, used
 *     only as a safety net if the explicit var is missing.
 *  3. http://localhost:3000 — local dev fallback.
 *
 * Always returned without a trailing slash.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;

  return "http://localhost:3000";
}
