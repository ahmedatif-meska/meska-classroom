import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DonutChart from "@/components/dashboard/DonutChart";

describe("DonutChart (feature 013)", () => {
  const colors = ["#1B5BFF", "#94A3B8"];

  it("renders proportional arcs and a text-equivalent aria-label + legend", () => {
    const { container } = render(
      <DonutChart
        title="Online vs offline waves"
        data={[
          { label: "online", value: 3 },
          { label: "offline", value: 2 },
        ]}
        colors={colors}
        emptyLabel="No data yet"
      />
    );

    // Accessible text equivalent on the svg (FR-012 / SC-005).
    const svg = screen.getByRole("img");
    expect(svg).toHaveAttribute(
      "aria-label",
      "Online vs offline waves: online 3, offline 2"
    );

    // One arc per datum, dash lengths proportional (3:2 of the circumference).
    const arcs = container.querySelectorAll("circle");
    expect(arcs).toHaveLength(2);
    const C = 2 * Math.PI * 42;
    const firstDash = arcs[0].getAttribute("stroke-dasharray")!.split(" ")[0];
    expect(Number(firstDash)).toBeCloseTo((3 / 5) * C, 3);

    // Legend lists both figures as text.
    expect(screen.getByText("online")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows the empty state when every value is zero", () => {
    render(
      <DonutChart
        title="Waves by status"
        data={[
          { label: "not_started", value: 0 },
          { label: "completed", value: 0 },
        ]}
        colors={colors}
        emptyLabel="No data yet"
      />
    );
    expect(screen.getByText("No data yet")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
