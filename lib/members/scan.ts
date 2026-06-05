/**
 * A member QR encodes the absolute member-info URL (see `memberInfoUrl`). When the
 * admin scans it, we only want to navigate to OUR own member route — never to an
 * arbitrary URL a stray QR might contain. `targetPathFromScan` validates the
 * decoded text and returns the in-app path `/admin/members/<id>` (origin stripped)
 * or null if it isn't a member QR.
 */
export function targetPathFromScan(decoded: string): string | null {
  const raw = decoded.trim();
  if (!raw) return null;

  // Accept either a full URL (the QR's normal form) or a bare path.
  let pathname = raw;
  try {
    pathname = new URL(raw).pathname;
  } catch {
    // not a full URL — treat the input as a path below
  }

  const match = pathname.match(/^\/admin\/members\/([^/?#]+)\/?$/);
  return match ? `/admin/members/${match[1]}` : null;
}
