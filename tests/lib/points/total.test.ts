import { describe, it, expect } from "vitest";
import { POINTS_EPOCH, computeTotal } from "@/lib/points/total";

describe("computeTotal (US5 — derived points)", () => {
  const defaults = { attendance: 10, assignment: 20, feedback: 30 };

  it("sums counts × rules (1/1/1 under 10/20/30 → 60)", () => {
    expect(
      computeTotal({ attendance: 1, assignment: 1, feedback: 1 }, defaults)
    ).toBe(60);
  });

  it("returns zero for zero counts (FR-022 — students start at zero)", () => {
    expect(
      computeTotal({ attendance: 0, assignment: 0, feedback: 0 }, defaults)
    ).toBe(0);
  });

  it("multiplies each action independently", () => {
    expect(
      computeTotal({ attendance: 3, assignment: 2, feedback: 1 }, defaults)
    ).toBe(3 * 10 + 2 * 20 + 1 * 30);
  });

  it("a zero-valued rule contributes nothing while others still count", () => {
    expect(
      computeTotal(
        { attendance: 5, assignment: 1, feedback: 2 },
        { attendance: 0, assignment: 20, feedback: 30 }
      )
    ).toBe(20 + 60);
  });

  it("reflects edited rule values retroactively (FR-029 — counts × CURRENT values)", () => {
    const counts = { attendance: 1, assignment: 1, feedback: 1 };
    expect(computeTotal(counts, defaults)).toBe(60);
    expect(computeTotal(counts, { ...defaults, feedback: 40 })).toBe(70);
  });

  it("exposes a valid ISO points epoch", () => {
    expect(Number.isNaN(Date.parse(POINTS_EPOCH))).toBe(false);
  });
});
