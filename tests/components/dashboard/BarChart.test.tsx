import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import BarChart from "@/components/dashboard/BarChart";

describe("BarChart (feature 013)", () => {
  it("renders one bar per datum with proportional widths and text labels", () => {
    const { container } = render(
      <BarChart
        title="Members per wave"
        data={[
          { label: "Wave A", value: 10 },
          { label: "Wave B", value: 5 },
        ]}
        emptyLabel="No data yet"
      />
    );
    expect(screen.getByText("Wave A")).toBeInTheDocument();
    expect(screen.getByText("Wave B")).toBeInTheDocument();

    const bars = container.querySelectorAll(".bg-brand");
    expect(bars).toHaveLength(2);
    expect((bars[0] as HTMLElement).style.width).toBe("100%"); // max → full
    expect((bars[1] as HTMLElement).style.width).toBe("50%");
  });

  it("shows the empty state for no data", () => {
    render(<BarChart title="Members per wave" data={[]} emptyLabel="No data yet" />);
    expect(screen.getByText("No data yet")).toBeInTheDocument();
  });
});
