import { describe, it, expect } from "vitest";
import { PANELS } from "@/lib/panels";

describe("PANELS", () => {
  it("student.home is /student", () => {
    expect(PANELS.student.home).toBe("/student");
  });

  it("admin.home is /admin", () => {
    expect(PANELS.admin.home).toBe("/admin");
  });

  it("each panel home matches /${id}", () => {
    for (const panel of Object.values(PANELS)) {
      expect(panel.home).toBe(`/${panel.id}`);
    }
  });

  it("student home does not reference admin", () => {
    expect(PANELS.student.home).not.toContain("admin");
  });

  it("admin home does not reference student", () => {
    expect(PANELS.admin.home).not.toContain("student");
  });
});
