"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

function MenuIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

export type NavItem = { label: string; href: string; icon?: React.ReactNode };

// Neutral single-item default (href="#") so a consumer that passes no navItems
// — e.g. the student dashboard — never leaks a cross-panel link (panel isolation).
const DEFAULT_NAV: NavItem[] = [
  { label: strings.dashboardLabel, href: "#", icon: <DashboardIcon /> },
];

const SIDEBAR_ID = "dashboard-sidebar";

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

  // Mobile-only drawer state. On md+ the sidebar is always-visible and static,
  // so this flag has no effect there.
  const [open, setOpen] = useState(false);

  // Close the drawer on Escape for keyboard users.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile backdrop — dims content and closes the drawer on tap. */}
      {open ? (
        <button
          type="button"
          aria-label={strings.closeNavLabel}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-ink/40 md:hidden"
        />
      ) : null}

      <aside
        id={SIDEBAR_ID}
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[82%] shrink-0 transform flex-col border-r border-slate-200 bg-surface transition-transform duration-300 ease-in-out md:static md:z-auto md:w-60 md:max-w-none md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label={`${panelName} navigation`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <span className="text-lg font-bold text-brand">{panelName}</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={strings.closeNavLabel}
            className="-mr-2 flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand md:hidden"
          >
            <ChevronLeftIcon />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {navItems.map((item) => {
            const active = item.href === resolvedActive;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={() => setOpen(false)}
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

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar — hosts the hamburger that opens the drawer. */}
        <header className="flex items-center gap-3 border-b border-slate-200 bg-surface px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={strings.openNavLabel}
            aria-expanded={open}
            aria-controls={SIDEBAR_ID}
            className="-ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-ink hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <MenuIcon />
          </button>
          <span className="text-lg font-bold text-brand">{panelName}</span>
        </header>

        <main className="flex-1 overflow-y-auto bg-page">{children}</main>
      </div>
    </div>
  );
}
