import Link from "next/link";
import DashboardShell from "@/components/DashboardShell";
import AdminSidebarFooter from "@/components/AdminSidebarFooter";
import { adminNavItems } from "@/lib/adminNav";
import { createClient } from "@/lib/supabase/server";
import strings from "@/lib/strings";

/**
 * /admin/errors — newest-first error log (feature 009, US2.1). RSC, zero client
 * JS. Reads run under the cookie/RLS client: the admin-only SELECT policy is the
 * non-bypassable boundary (a non-admin reaching this somehow sees zero rows),
 * and the proxy matcher redirects non-admins away before that.
 *
 * Reads are bounded to PAGE_SIZE rows per request (`?page=N`, Principle V).
 */

const PAGE_SIZE = 50;
const MESSAGE_PREVIEW = 80;

export type ErrorLogListRow = {
  id: string;
  occurred_at: string;
  surface: string;
  origin: string;
  severity: string;
  operation: string;
  message: string;
  user_id: string | null;
  user_role: string | null;
};

const TH = "whitespace-nowrap px-6 py-3 font-semibold";
const TD = "whitespace-nowrap px-6 py-4 align-middle";

/** Deterministic UTC display (no locale drift between server renders). */
function formatTime(iso: string) {
  return `${iso.replace("T", " ").slice(0, 19)} UTC`;
}

function SeverityChip({ severity }: { severity: string }) {
  const tone =
    severity === "warning"
      ? "bg-amber-100 text-amber-700"
      : severity === "fatal"
        ? "bg-red-600 text-white"
        : "bg-red-100 text-red-700";
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${tone}`}
    >
      {severity}
    </span>
  );
}

function userLabel(row: ErrorLogListRow) {
  if (!row.user_id) return strings.errorLogAnonymous;
  const id = `${row.user_id.slice(0, 8)}…`;
  return row.user_role ? `${row.user_role} · ${id}` : id;
}

export default async function ErrorsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "", 10) || 1);
  const fromIdx = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, count } = await supabase
    .from("error_logs")
    .select(
      "id, occurred_at, surface, origin, severity, operation, message, user_id, user_role",
      { count: "exact" }
    )
    .order("occurred_at", { ascending: false })
    .range(fromIdx, fromIdx + PAGE_SIZE - 1);

  const rows = (data ?? []) as ErrorLogListRow[];
  const total = count ?? rows.length;
  const hasOlder = total > page * PAGE_SIZE;

  return (
    <DashboardShell
      panelName={strings.adminPanelName}
      navItems={adminNavItems}
      activeHref="/admin/errors"
      footer={<AdminSidebarFooter email={user?.email ?? ""} />}
    >
      <div className="p-8">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ink">{strings.errorLogTitle}</h1>
          <p className="mt-1 text-sm text-slate-500">{strings.errorLogSubtitle}</p>
        </div>

        {rows.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-surface py-16 text-center text-sm text-slate-400">
            {strings.errorLogEmptyNote}
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-2xl bg-surface shadow-sm">
            {/* Contained horizontal scroll on narrow screens (the AdminTable
                pattern) — the page/body never scrolls sideways. */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <th className={TH}>{strings.errorLogColTime}</th>
                    <th className={TH}>{strings.errorLogColSeverity}</th>
                    <th className={TH}>{strings.errorLogColSurface}</th>
                    <th className={TH}>{strings.errorLogColOrigin}</th>
                    <th className={TH}>{strings.errorLogColOperation}</th>
                    <th className={TH}>{strings.errorLogColMessage}</th>
                    <th className={TH}>{strings.errorLogColUser}</th>
                    <th className={`${TH} text-right`} aria-hidden="true" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      data-testid="error-log-row"
                      className="border-b border-slate-100 last:border-b-0"
                    >
                      <td className={`${TD} text-sm text-slate-500`}>
                        {formatTime(r.occurred_at)}
                      </td>
                      <td className={TD}>
                        <SeverityChip severity={r.severity} />
                      </td>
                      <td className={`${TD} text-sm text-slate-500`}>{r.surface}</td>
                      <td className={`${TD} text-sm text-slate-500`}>{r.origin}</td>
                      <td className={TD}>
                        <Link
                          href={`/admin/errors/${r.id}`}
                          className="font-semibold text-ink hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand rounded-sm"
                        >
                          {r.operation}
                        </Link>
                      </td>
                      <td className={`${TD} max-w-[360px] truncate text-sm text-slate-500`}>
                        {r.message.length > MESSAGE_PREVIEW
                          ? `${r.message.slice(0, MESSAGE_PREVIEW)}…`
                          : r.message}
                      </td>
                      <td className={`${TD} text-sm text-slate-500`}>{userLabel(r)}</td>
                      <td className={`${TD} text-right`}>
                        <Link
                          href={`/admin/errors/${r.id}`}
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-ink hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                        >
                          {strings.errorLogViewLabel}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(page > 1 || hasOlder) && (
          <nav className="mt-4 flex items-center justify-between">
            {page > 1 ? (
              <Link
                href={`/admin/errors?page=${page - 1}`}
                className="rounded-full border border-slate-200 bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {strings.errorLogNewerLabel}
              </Link>
            ) : (
              <span />
            )}
            {hasOlder ? (
              <Link
                href={`/admin/errors?page=${page + 1}`}
                className="rounded-full border border-slate-200 bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {strings.errorLogOlderLabel}
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>
    </DashboardShell>
  );
}
