import { describe, it, expect } from "vitest";
import { sanitizeDescription } from "@/lib/instructors/sanitize";

describe("sanitizeDescription (US2.1, FR-009 / SC-007)", () => {
  it("returns an empty string for blank input", () => {
    expect(sanitizeDescription("")).toBe("");
    expect(sanitizeDescription("   ")).toBe("");
    expect(sanitizeDescription(null)).toBe("");
  });

  it("strips <script> tags entirely", () => {
    const out = sanitizeDescription("<p>Hi</p><script>alert(1)</script>");
    expect(out).toContain("<p>Hi</p>");
    expect(out.toLowerCase()).not.toContain("script");
    expect(out).not.toContain("alert(1)");
  });

  it("strips event-handler attributes", () => {
    const out = sanitizeDescription('<p onclick="evil()">Hi</p>');
    expect(out).not.toContain("onclick");
    expect(out).toContain("Hi");
  });

  it("drops javascript: links but keeps safe http(s) links as new-tab anchors", () => {
    const evil = sanitizeDescription('<a href="javascript:evil()">x</a>');
    expect(evil.toLowerCase()).not.toContain("javascript:");

    const safe = sanitizeDescription('<a href="https://x.com/meska">meska</a>');
    expect(safe).toContain('href="https://x.com/meska"');
    expect(safe).toContain('target="_blank"');
    expect(safe).toContain("noopener");
  });

  it("preserves allowed formatting tags", () => {
    const out = sanitizeDescription(
      "<p><strong>Bold</strong> <em>it</em> <u>u</u></p><ul><li>one</li></ul>"
    );
    expect(out).toContain("<strong>Bold</strong>");
    expect(out).toContain("<em>it</em>");
    expect(out).toContain("<u>u</u>");
    expect(out).toContain("<li>one</li>");
  });

  it("keeps spans with allowed size/color/font classes but drops other classes", () => {
    const size = sanitizeDescription('<span class="rte-fs-24">big</span>');
    expect(size).toContain('class="rte-fs-24"');
    expect(size).toContain("big");

    const color = sanitizeDescription('<span class="rte-c-brand">blue</span>');
    expect(color).toContain('class="rte-c-brand"');

    const font = sanitizeDescription('<span class="rte-ff-serif">serif</span>');
    expect(font).toContain('class="rte-ff-serif"');

    const disallowed = sanitizeDescription('<span class="evil-class">x</span>');
    expect(disallowed).not.toContain("evil-class");
    expect(disallowed).toContain("x");
  });

  it("strips inline style attributes", () => {
    const out = sanitizeDescription('<span style="font-size:99px">x</span>');
    expect(out).not.toContain("style");
  });
});
