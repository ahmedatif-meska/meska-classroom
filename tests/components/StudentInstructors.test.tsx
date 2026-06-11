import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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

  it("lists each instructor with name and sanitized description", async () => {
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
    expect(screen.getByText("AI researcher")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Omar Khan" })
    ).toBeInTheDocument();
    // No empty-state note once instructors exist.
    expect(
      screen.queryByText(strings.studentInstructorsEmptyNote)
    ).not.toBeInTheDocument();
  });
});
