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

export default function DashboardShell({
  panelName,
  children,
  footer,
}: {
  panelName: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <aside
        className="w-60 shrink-0 bg-surface border-r border-slate-200 flex flex-col"
        aria-label={`${panelName} navigation`}
      >
        <div className="px-6 py-5 border-b border-slate-100">
          <span className="text-lg font-bold text-brand">{panelName}</span>
        </div>
        <nav className="flex-1 p-3">
          <a
            href="#"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-brand/10 text-brand font-semibold text-sm"
            aria-current="page"
          >
            <DashboardIcon />
            {strings.dashboardLabel}
          </a>
        </nav>
        {footer ? (
          <div className="mt-auto border-t border-slate-100 p-3">{footer}</div>
        ) : null}
      </aside>

      <main className="flex-1 overflow-y-auto bg-page">{children}</main>
    </div>
  );
}
