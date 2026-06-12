import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import strings from "@/lib/strings";

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (props: Record<string, unknown>) => <img {...props} />,
}));
vi.mock("@/components/InstructorFormModal", () => ({
  default: () => <span data-testid="edit" />,
}));
vi.mock("@/components/RemoveInstructorDialog", () => ({
  default: () => <span data-testid="remove" />,
}));

const reorder = vi.fn(async () => ({ saved: true }));
vi.mock("@/app/admin/instructors/actions", () => ({
  reorderInstructors: (ids: string[]) => reorder(ids),
}));

import InstructorTable, { type InstructorRow } from "@/components/InstructorTable";

const rows: InstructorRow[] = [
  {
    id: "a",
    name: "Alpha",
    title: "Lead Instructor",
    description_html: null,
    image_path: null,
    created_at: "2026-01-01T00:00:00Z",
    position: 1,
  },
  {
    id: "b",
    name: "Beta",
    title: "Guest Instructor",
    description_html: null,
    image_path: null,
    created_at: "2026-01-02T00:00:00Z",
    position: 2,
  },
];

beforeEach(() => vi.clearAllMocks());

describe("InstructorTable", () => {
  it("renders each instructor's title under the name", () => {
    render(<InstructorTable instructors={rows} />);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Lead Instructor")).toBeInTheDocument();
    expect(screen.getByText("Guest Instructor")).toBeInTheDocument();
  });

  it("moving the first instructor down persists the swapped order", async () => {
    render(<InstructorTable instructors={rows} />);
    fireEvent.click(
      screen.getByRole("button", {
        name: `${strings.instructorMoveDownLabel} — Alpha`,
      })
    );
    await waitFor(() => expect(reorder).toHaveBeenCalledWith(["b", "a"]));
  });

  it("disables Move up on the first row and Move down on the last", () => {
    render(<InstructorTable instructors={rows} />);
    expect(
      screen.getByRole("button", {
        name: `${strings.instructorMoveUpLabel} — Alpha`,
      })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: `${strings.instructorMoveDownLabel} — Beta`,
      })
    ).toBeDisabled();
  });
});
