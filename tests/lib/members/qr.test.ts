import { describe, it, expect, beforeEach } from "vitest";
import { memberInfoUrl, renderQrSvg } from "@/lib/members/qr";

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://classroom.test";
});

describe("member QR helpers (US2.1 / US4.1)", () => {
  it("memberInfoUrl points at the admin-only member-info page", () => {
    expect(memberInfoUrl("abc-123")).toBe(
      "https://classroom.test/admin/members/abc-123"
    );
  });

  it("renderQrSvg returns an inline SVG for the URL", async () => {
    const svg = await renderQrSvg(memberInfoUrl("abc-123"));
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });
});
