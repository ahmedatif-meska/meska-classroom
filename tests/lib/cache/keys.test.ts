import { describe, it, expect } from "vitest";
import { adminListKey, studentKey } from "@/lib/cache/keys";

/**
 * The cache-key audience rule is the load-bearing wave-isolation invariant
 * (Principle VI): a student key MUST carry both the tenant and the user, and no admin
 * key may ever collide with a student key.
 */
describe("cache keys — audience isolation (US2.3 / Principle VI)", () => {
  it("builds admin-scoped, global list keys", () => {
    expect(adminListKey("instructors")).toBe("admin:instructors:list");
    expect(adminListKey("members")).toBe("admin:members:list");
    expect(adminListKey("waves")).toBe("admin:waves:list");
  });

  it("builds a student key scoped to BOTH tenant and user", () => {
    expect(studentKey("wave-A", "user-1", "profile")).toBe(
      "student:wave-A:user-1:profile"
    );
  });

  it("never produces the same key for two different waves", () => {
    expect(studentKey("wave-A", "user-1", "profile")).not.toBe(
      studentKey("wave-B", "user-1", "profile")
    );
  });

  it("never produces the same key for two different users in the same wave", () => {
    expect(studentKey("wave-A", "user-1", "profile")).not.toBe(
      studentKey("wave-A", "user-2", "profile")
    );
  });

  it("refuses to build a key with a missing tenant (no audience dimension may be dropped)", () => {
    expect(() => studentKey("", "user-1", "profile")).toThrow();
  });

  it("refuses to build a key with a missing user", () => {
    expect(() => studentKey("wave-A", "", "profile")).toThrow();
  });

  it("keeps admin and student key namespaces disjoint", () => {
    const adminKeys = [adminListKey("instructors"), adminListKey("members")];
    const student = studentKey("wave-A", "user-1", "profile");
    expect(adminKeys).not.toContain(student);
    expect(student.startsWith("student:")).toBe(true);
    expect(adminKeys.every((k) => k.startsWith("admin:"))).toBe(true);
  });
});
