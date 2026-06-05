import QRCode from "qrcode";
import { siteUrl } from "@/lib/siteUrl";

/**
 * The QR a member shows on their home encodes the admin-only member-information
 * page URL. `memberInfoUrl` is the single source of truth for that URL; the QR is
 * rendered as an inline SVG (no external image service, no extra network request).
 * The origin comes from `siteUrl()` (NEXT_PUBLIC_SITE_URL), so it points at the
 * deployed app — not localhost — once that variable is set for the environment.
 */
export function memberInfoUrl(id: string): string {
  return `${siteUrl()}/admin/members/${id}`;
}

/** Render a QR code for the given URL as an inline SVG string (server-side). */
export function renderQrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: "svg", margin: 1, width: 240 });
}
