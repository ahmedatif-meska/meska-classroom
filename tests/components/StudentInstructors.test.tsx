import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import strings from "@/lib/strings";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

let instructors: {
  id: string;
  name: string;
  description_html: string | null;
  image_path: string | null;
}[] = [];

const order = vi.fn(async () => ({ data: instructors }));
const select = vi.fn(() => ({ order }));
const from = vi.fn(() => ({ select }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from })),
}));

import StudentInstructors from "@/components/StudentInstructors";

beforeEach(() => {
  vi.clearAllMocks();
  instructors = [];
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
});

describe("StudentInstructors", () => {
  it("shows the About instructors heading", async () => {
    render(await StudentInstructors());
    expect(
      screen.getByRole("heading", { name: strings.studentInstructorsTitle })
    ).toBeInTheDocument();
  });

  it("renders an empty state when there are no instructors", async () => {
    render(await StudentInstructors());
    expect(
      screen.getByText(strings.studentInstructorsEmptyNote)
    ).toBeInTheDocument();
  });

  it("lists each instructor as a compact name row (no bio)", async () => {
    instructors = [
      {
        id: "i1",
        name: "Dr. Sarah Lee",
        description_html: "<p>AI researcher</p>",
        image_path: "i1.png",
      },
      {
        id: "i2",
        name: "Omar Khan",
        description_html: null,
        image_path: null,
      },
    ];
    render(await StudentInstructors());
    expect(
      screen.getByRole("heading", { name: "Dr. Sarah Lee" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Omar Khan" })
    ).toBeInTheDocument();
    // Compact rows show name only — the bio is not rendered here.
    expect(screen.queryByText("AI researcher")).not.toBeInTheDocument();
    // No empty-state note once instructors exist.
    expect(
      screen.queryByText(strings.studentInstructorsEmptyNote)
    ).not.toBeInTheDocument();
  });

  it("previews two instructors and toggles the rest with View All / Show less", async () => {
    instructors = [
      { id: "i1", name: "Alice", description_html: null, image_path: null },
      { id: "i2", name: "Bob", description_html: null, image_path: null },
      { id: "i3", name: "Carol", description_html: null, image_path: null },
    ];
    render(await StudentInstructors());

    // Only the first two show until expanded.
    expect(screen.getByRole("heading", { name: "Alice" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bob" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Carol" })
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: strings.studentInstructorsViewAllLabel,
      })
    );
    expect(screen.getByRole("heading", { name: "Carol" })).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: strings.studentInstructorsShowLessLabel,
      })
    );
    expect(
      screen.queryByRole("heading", { name: "Carol" })
    ).not.toBeInTheDocument();
  });

  it("opens a detail modal with the instructor's bio when a row is clicked", async () => {
    instructors = [
      {
        id: "i1",
        name: "Dr. Sarah Lee",
        description_html: "<p>AI researcher and educator</p>",
        image_path: null,
      },
    ];
    render(await StudentInstructors());
    // The bio is not visible until the row is opened.
    expect(
      screen.queryByText("AI researcher and educator")
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: `${strings.studentInstructorViewDetailsLabel} — Dr. Sarah Lee`,
      })
    );
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText("AI researcher and educator")
    ).toBeInTheDocument();
  });

  it("shows a no-bio note in the modal when an instructor has no description", async () => {
    instructors = [
      { id: "i1", name: "Omar Khan", description_html: null, image_path: null },
    ];
    render(await StudentInstructors());
    fireEvent.click(
      screen.getByRole("button", {
        name: `${strings.studentInstructorViewDetailsLabel} — Omar Khan`,
      })
    );
    expect(
      within(screen.getByRole("dialog")).getByText(
        strings.studentInstructorNoBio
      )
    ).toBeInTheDocument();
  });

  it("shows no View All toggle when there are two or fewer instructors", async () => {
    instructors = [
      { id: "i1", name: "Alice", description_html: null, image_path: null },
      { id: "i2", name: "Bob", description_html: null, image_path: null },
    ];
    render(await StudentInstructors());
    expect(
      screen.queryByRole("button", {
        name: strings.studentInstructorsViewAllLabel,
      })
    ).not.toBeInTheDocument();
  });
});
