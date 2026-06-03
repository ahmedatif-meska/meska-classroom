import Link from "next/link";
import strings from "@/lib/strings";

function DashboardIcon() {
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
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

export type NavItem = { label: string; href: string; icon?: React.ReactNode };

// Neutral single-item default (href="#") so a consumer that passes no navItems
// — e.g. the student dashboard — never leaks a cross-panel link (panel isolation).
const DEFAULT_NAV: NavItem[] = [
  { label: strings.dashboardLabel, href: "#", icon: <DashboardIcon /> },
];

export default function DashboardShell({
  panelName,
  children,
  footer,
  navItems = DEFAULT_NAV,
  activeHref,
}: {
  panelName: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  navItems?: NavItem[];
  activeHref?: string;
}) {
  // Default the active item to the first nav entry (so a single-item nav stays
  // highlighted as before when no activeHref is supplied).
  const resolvedActive = activeHref ?? navItems[0]?.href;

  return (
    <div className="flex h-screen overflow-hidden">
      <aside
        className="w-60 shrink-0 bg-surface border-r border-slate-200 flex flex-col"
        aria-label={`${panelName} navigation`}
      >
        <div className="px-6 py-5 border-b border-slate-100">
          <span className="text-lg font-bold text-brand">{panelName}</span>
        </div>
        <nav className="flex-1 p-3 flex flex-col gap-1">
          {navItems.map((item) => {
            const active = item.href === resolvedActive;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "flex items-center gap-3 px-3 py-2.5 rounded-lg bg-brand/10 text-brand font-semibold text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    : "flex items-center gap-3 px-3 py-2.5 rounded-lg text-ink font-semibold text-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                }
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>
        {footer ? (
          <div className="mt-auto border-t border-slate-100 p-3">{footer}</div>
        ) : null}
      </aside>

      <main className="flex-1 overflow-y-auto bg-page">{children}</main>
    </div>
  );
}
