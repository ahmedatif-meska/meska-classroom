import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import strings from "@/lib/strings";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

// Stub the Server Actions so the client islands don't pull server-only deps.
vi.mock("@/app/admin/instructors/actions", () => ({
  createInstructor: vi.fn(),
  updateInstructor: vi.fn(),
  removeInstructor: vi.fn(),
}));
vi.mock("@/app/admin/actions", () => ({ signOutAdmin: vi.fn() }));

type Row = {
  id: string;
  name: string;
  description_html: string | null;
  image_path: string | null;
  created_at: string;
};

let rows: Row[] = [];

const order = vi.fn(async () => ({ data: rows, error: null }));
const select = vi.fn(() => ({ order }));
const from = vi.fn(() => ({ select }));
const getUser = vi.fn(async () => ({
  data: { user: { id: "admin-1", email: "ahmedatif@meska.ai" } },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, from })),
}));

import InstructorsPage from "@/app/admin/instructors/page";

beforeEach(() => {
  vi.clearAllMocks();
  rows = [
    {
      id: "i1",
      name: "Dr. Sarah Lee",
      description_html: "<p>Teaches <strong>AI</strong></p>",
      image_path: "i1.png",
      created_at: "2026-06-01T00:00:00Z",
    },
    {
      id: "i2",
      name: "Omar Hassan",
      description_html: null,
      image_path: null,
      created_at: "2026-05-20T00:00:00Z",
    },
  ];
});

describe("Instructors page (US1.1)", () => {
  it("renders a table row per instructor with name and formatted added date", async () => {
    render(await InstructorsPage());
    expect(screen.getByText("Dr. Sarah Lee")).toBeInTheDocument();
    expect(screen.getByText("Omar Hassan")).toBeInTheDocument();
    // The table column headers are present.
    expect(
      screen.getByRole("columnheader", { name: strings.instructorsColName })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: strings.instructorsColAdded })
    ).toBeInTheDocument();
    // The description is intentionally NOT shown in the table.
    expect(screen.queryByText("AI")).not.toBeInTheDocument();
  });

  it("renders the Instructors nav entry and the Add Instructor action", async () => {
    render(await InstructorsPage());
    expect(
      screen.getByRole("link", { name: strings.instructorsNavLabel })
    ).toHaveAttribute("href", "/admin/instructors");
    expect(
      screen.getByRole("button", { name: strings.instructorsAddLabel })
    ).toBeInTheDocument();
  });

  it("exposes edit and remove controls per instructor", async () => {
    render(await InstructorsPage());
    expect(
      screen.getByRole("button", {
        name: new RegExp(`${strings.instructorEditLabel}.*Dr. Sarah Lee`),
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: new RegExp(`${strings.removeInstructorSubmitLabel}.*Omar Hassan`),
      })
    ).toBeInTheDocument();
  });

  it("shows the empty state when there are no instructors", async () => {
    rows = [];
    render(await InstructorsPage());
    expect(screen.getByText(strings.instructorsEmptyNote)).toBeInTheDocument();
  });
});
