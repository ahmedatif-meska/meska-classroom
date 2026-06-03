export type Panel = {
  id: "student" | "admin";
  home: string;
  nameKey: "studentPanelName" | "adminPanelName";
};

function makePanel(
  id: "student" | "admin",
  nameKey: Panel["nameKey"]
): Panel {
  return { id, home: `/${id}`, nameKey };
}

export const PANELS = {
  student: makePanel("student", "studentPanelName"),
  admin: makePanel("admin", "adminPanelName"),
} as const satisfies Record<string, Panel>;
