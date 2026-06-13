import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import strings from "@/lib/strings";

const markAttendance = vi.fn<
  (
    prev: unknown,
    fd: FormData
  ) => Promise<{ error?: string; marked?: boolean; alreadyAttended?: boolean }>
>(async () => ({ marked: true }));
vi.mock("@/app/admin/attendance/actions", () => ({
  markAttendance: (prev: unknown, fd: FormData) => markAttendance(prev, fd),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import AttendancePanel from "@/components/AttendancePanel";

const waves = [
  {
    id: "wave-new",
    name: "July 2026 Cohort",
    weeks: [
      { id: "wk-1", label: "Week 1" },
      { id: "wk-2", label: "Week 2 — Agents" },
    ],
  },
  {
    id: "wave-old",
    name: "May 2026 Cohort",
    weeks: [{ id: "wk-old", label: "Week 1" }],
  },
  { id: "wave-empty", name: "Empty Cohort", weeks: [] },
];

beforeEach(() => {
  vi.clearAllMocks();
  markAttendance.mockResolvedValue({ marked: true });
});

describe("AttendancePanel (US2)", () => {
  it("lists the offline waves in the given (newest-first) order", () => {
    render(<AttendancePanel studentId="stu-1" waves={waves} />);
    const waveSelect = screen.getByLabelText(strings.attendanceWaveLabel);
    const options = within(waveSelect).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "July 2026 Cohort",
      "May 2026 Cohort",
      "Empty Cohort",
    ]);
  });

  it("repopulates the week dropdown from the selected wave", async () => {
    const user = userEvent.setup();
    render(<AttendancePanel studentId="stu-1" waves={waves} />);
    const weekSelect = screen.getByLabelText(strings.attendanceWeekLabel);
    expect(
      within(weekSelect)
        .getAllByRole("option")
        .map((o) => o.textContent)
    ).toEqual(["Week 1", "Week 2 — Agents"]);

    await user.selectOptions(
      screen.getByLabelText(strings.attendanceWaveLabel),
      "wave-old"
    );
    expect(
      within(screen.getByLabelText(strings.attendanceWeekLabel))
        .getAllByRole("option")
        .map((o) => o.textContent)
    ).toEqual(["Week 1"]);
  });

  it("preselects the student's own wave when provided", () => {
    render(
      <AttendancePanel studentId="stu-1" waves={waves} defaultWaveId="wave-old" />
    );
    expect(
      (screen.getByLabelText(strings.attendanceWaveLabel) as HTMLSelectElement)
        .value
    ).toBe("wave-old");
  });

  it("shows the no-weeks note and disables Attend for a week-less wave", async () => {
    const user = userEvent.setup();
    render(<AttendancePanel studentId="stu-1" waves={waves} />);
    await user.selectOptions(
      screen.getByLabelText(strings.attendanceWaveLabel),
      "wave-empty"
    );
    expect(screen.getByText(strings.attendanceNoWeeksNote)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: strings.attendanceAttendLabel })
    ).toBeDisabled();
  });

  it("submits student, wave, and week on Attend", async () => {
    const user = userEvent.setup();
    render(<AttendancePanel studentId="stu-1" waves={waves} />);
    await user.click(
      screen.getByRole("button", { name: strings.attendanceAttendLabel })
    );
    expect(markAttendance).toHaveBeenCalledOnce();
    const fd = markAttendance.mock.calls[0][1];
    expect(fd.get("student_id")).toBe("stu-1");
    expect(fd.get("wave_id")).toBe("wave-new");
    expect(fd.get("week_id")).toBe("wk-1");
  });

  it("shows the success modal with Next and Back on marked", async () => {
    const user = userEvent.setup();
    render(<AttendancePanel studentId="stu-1" waves={waves} />);
    await user.click(
      screen.getByRole("button", { name: strings.attendanceAttendLabel })
    );

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(strings.attendanceSuccessTitle)
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("link", { name: strings.attendanceNextLabel })
    ).toHaveAttribute("href", "/admin/attendance?scan=1");
    expect(
      within(dialog).getByRole("link", { name: strings.attendanceBackLabel })
    ).toHaveAttribute("href", "/admin/dashboard");
  });

  it("closes the success modal on Escape", async () => {
    const user = userEvent.setup();
    render(<AttendancePanel studentId="stu-1" waves={waves} />);
    await user.click(
      screen.getByRole("button", { name: strings.attendanceAttendLabel })
    );
    await screen.findByRole("dialog");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the already-attended notice (no success modal) on a same-day repeat", async () => {
    markAttendance.mockResolvedValueOnce({ alreadyAttended: true });
    const user = userEvent.setup();
    render(<AttendancePanel studentId="stu-1" waves={waves} />);
    await user.click(
      screen.getByRole("button", { name: strings.attendanceAttendLabel })
    );

    expect(
      await screen.findByText(strings.attendanceAlreadyTitle)
    ).toBeInTheDocument();
    expect(
      screen.getByText(strings.attendanceAlreadyNote)
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders an action error as an alert", async () => {
    markAttendance.mockResolvedValueOnce({
      error: strings.attendanceWrongWave,
    });
    const user = userEvent.setup();
    render(<AttendancePanel studentId="stu-1" waves={waves} />);
    await user.click(
      screen.getByRole("button", { name: strings.attendanceAttendLabel })
    );
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(strings.attendanceWrongWave);
  });
});
