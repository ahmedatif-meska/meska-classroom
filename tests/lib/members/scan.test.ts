import { describe, it, expect } from "vitest";
import { targetPathFromScan } from "@/lib/members/scan";

describe("targetPathFromScan", () => {
  it("extracts the member path from a full QR URL", () => {
    expect(
      targetPathFromScan("https://meska-classroom.vercel.app/admin/members/abc-123")
    ).toBe("/admin/members/abc-123");
  });

  it("accepts a bare path too", () => {
    expect(targetPathFromScan("/admin/members/xyz")).toBe("/admin/members/xyz");
  });

  it("ignores a trailing slash and query/hash", () => {
    expect(
      targetPathFromScan("https://x.test/admin/members/m1/?a=b#c")
    ).toBe("/admin/members/m1");
  });

  it("rejects a non-member URL (no navigation to arbitrary links)", () => {
    expect(targetPathFromScan("https://evil.example.com/phish")).toBeNull();
    expect(targetPathFromScan("https://x.test/admin/instructors/1")).toBeNull();
    expect(targetPathFromScan("/admin/members")).toBeNull();
    expect(targetPathFromScan("")).toBeNull();
    expect(targetPathFromScan("   ")).toBeNull();
  });
});
