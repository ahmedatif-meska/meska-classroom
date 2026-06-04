import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import strings from "@/lib/strings";

const createInstructor = vi.fn();
const updateInstructor = vi.fn();
vi.mock("@/app/admin/instructors/actions", () => ({
  createInstructor: (prev: unknown, fd: FormData) => createInstructor(prev, fd),
  updateInstructor: (prev: unknown, fd: FormData) => updateInstructor(prev, fd),
}));

import InstructorFormModal from "@/components/InstructorFormModal";

beforeEach(() => {
  vi.clearAllMocks();
  createInstructor.mockResolvedValue({});
  updateInstructor.mockResolvedValue({});
});

async function openAdd() {
  const user = userEvent.setup();
  render(<InstructorFormModal />);
  await user.click(
    screen.getByRole("button", { name: strings.instructorsAddLabel })
  );
  return user;
}

describe("InstructorFormModal (US2.1)", () => {
  it("opens the Add Instructor dialog with a required name and a rich-text editor", async () => {
    await openAdd();
    expect(
      screen.getByRole("heading", { name: strings.instructorFormAddTitle })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/name/i)).toBeRequired();
    // contentEditable editor, identified by its "Description" label.
    expect(
      screen.getByRole("textbox", { name: strings.instructorDescriptionLabel })
    ).toBeInTheDocument();
  });

  it("closes without saving when Cancel is clicked", async () => {
    const user = await openAdd();
    await user.click(screen.getByRole("button", { name: strings.cancelLabel }));
    expect(
      screen.queryByRole("heading", { name: strings.instructorFormAddTitle })
    ).not.toBeInTheDocument();
    expect(createInstructor).not.toHaveBeenCalled();
  });

  it("rejects an unsupported image client-side without calling the action", async () => {
    await openAdd();
    const gif = new File([new Uint8Array(10)], "a.gif", { type: "image/gif" });
    // fireEvent.change bypasses the input's `accept` filter so we exercise the
    // component's own client-side validation directly.
    fireEvent.change(screen.getByLabelText(strings.instructorImageLabel), {
      target: { files: [gif] },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      strings.instructorsImageInvalid
    );
    expect(createInstructor).not.toHaveBeenCalled();
  });

  it("opens in edit mode pre-populated with the instructor name", async () => {
    const user = userEvent.setup();
    render(
      <InstructorFormModal
        instructor={{
          id: "i1",
          name: "Dr. Sarah Lee",
          description_html: "<p>x</p>",
          image_path: null,
          created_at: "2026-06-01T00:00:00Z",
        }}
      />
    );
    await user.click(
      screen.getByRole("button", {
        name: new RegExp(`${strings.instructorEditLabel}.*Dr. Sarah Lee`),
      })
    );
    expect(
      screen.getByRole("heading", { name: strings.instructorFormEditTitle })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/name/i)).toHaveValue("Dr. Sarah Lee");
  });
});
