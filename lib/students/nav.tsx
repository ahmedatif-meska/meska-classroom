import type { NavItem } from "@/components/DashboardShell";
import { createClient } from "@/lib/supabase/server";
import strings from "@/lib/strings";

function HomeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 9.5 12 3l9 6.5" />
      <path d="M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10" />
      <path d="M9 21v-6h6v6" />
    </svg>
  );
}

function WeeksIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="16" y1="2" x2="16" y2="6" />
    </svg>
  );
}

type WeekRow = { id: string; title: string | null; position: number };

/**
 * Builds the student sidebar nav: a Home entry plus a collapsible **Weeks** group
 * whose children are EXACTLY the caller's own wave's weeks (RLS scopes the
 * `wave_weeks` read to `tenant_id = jwt_tenant_id()`, and we also filter by the
 * passed tenant id). A null tenant or zero weeks yields an empty Weeks group that
 * the shell renders with an empty-state label. Never lists another wave's weeks
 * (Principle VI).
 */
export async function buildStudentNav(
  tenantId: string | null
): Promise<NavItem[]> {
  const home: NavItem = {
    label: strings.studentHomeNavLabel,
    href: "/student/dashboard",
    icon: <HomeIcon />,
  };

  let children: NavItem[] = [];
  if (tenantId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("wave_weeks")
      .select("id, title, position")
      .eq("tenant_id", tenantId)
      .order("position", { ascending: true });
    children = ((data ?? []) as WeekRow[]).map((w) => ({
      label: w.title || `${strings.weekDefaultTitle} ${w.position}`,
      href: `/student/dashboard/weeks/${w.id}`,
    }));
  }

  const weeks: NavItem = {
    label: strings.studentWeeksNavLabel,
    href: "#weeks",
    icon: <WeeksIcon />,
    children,
    childrenEmptyLabel: strings.studentWeeksEmptyNote,
  };

  return [home, weeks];
}
