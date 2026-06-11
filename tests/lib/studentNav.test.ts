import { describe, it, expect, vi, beforeEach } from "vitest";

let weeks: { id: string; title: string | null; position: number }[] = [];
const order = vi.fn(async () => ({ data: weeks }));
const eq = vi.fn(() => ({ order }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from })),
}));

import { buildStudentNav } from "@/lib/students/nav";

beforeEach(() => {
  weeks = [];
  vi.clearAllMocks();
});

describe("buildStudentNav", () => {
  it("returns Home first, then a Weeks group", async () => {
    const nav = await buildStudentNav("wave-A");
    expect(nav[0].href).toBe("/student/dashboard");
    expect(nav[0].label).toBe("Home");
    expect(nav[1].label).toBe("Weeks");
    expect(nav[1].children).toBeDefined();
  });

  it("numbers weeks ('Week N') in position order, with the week's name as a sublabel", async () => {
    weeks = [
      { id: "w1", title: null, position: 1 },
      { id: "w2", title: "Prompting", position: 2 },
    ];
    const nav = await buildStudentNav("wave-A");
    const children = nav[1].children!;
    // Numbered labels (not the custom title) drive the dropdown.
    expect(children.map((c) => c.label)).toEqual(["Week 1", "Week 2"]);
    expect(children.map((c) => c.href)).toEqual([
      "/student/dashboard/weeks/w1",
      "/student/dashboard/weeks/w2",
    ]);
    // The week's own name appears as a secondary line when set.
    expect(children[0].sublabel).toBeUndefined();
    expect(children[1].sublabel).toBe("Prompting");
    // Each item has a pretty icon.
    expect(children[0].icon).toBeDefined();
    // Scoped to the caller's wave.
    expect(eq).toHaveBeenCalledWith("tenant_id", "wave-A");
    expect(order).toHaveBeenCalledWith("position", { ascending: true });
  });

  it("yields an empty Weeks group when the student has no wave", async () => {
    const nav = await buildStudentNav(null);
    expect(nav[1].children).toEqual([]);
    // No query is issued without a tenant id.
    expect(from).not.toHaveBeenCalled();
  });

  it("yields an empty Weeks group when the wave has no weeks", async () => {
    weeks = [];
    const nav = await buildStudentNav("wave-A");
    expect(nav[1].children).toEqual([]);
  });
});
