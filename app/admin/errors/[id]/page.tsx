import Link from "next/link";
import { notFound } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import AdminSidebarFooter from "@/components/AdminSidebarFooter";
import { adminNavItems } from "@/lib/adminNav";
import { createClient } from "@/lib/supabase/server";
import strings from "@/lib/strings";

/**
 * /admin/errors/[id] — full detail for one error log entry (feature 009,
 * US2.1). RSC, zero client JS. RLS (admin-only SELECT) is the boundary; the
 * proxy redirects non-admins before that. Stack trace and context render in
 * contained-scroll <pre> blocks so a long trace can never widen the page
 * (Principle IV — the page/body never scrolls sideways, even at 320px).
 */

type ErrorLogRow = {
  id: string;
  occurred_at: string;
  surface: string;
  origin: string;
  severity: string;
  operation: string;
  message: string;
  stack: string | null;
  context: Record<string, unknown> | null;
  user_id: string | null;
  user_role: string | null;
  tenant_id: string | null;
  environment: string | null;
};

function formatTime(iso: string) {
  return `${iso.replace("T", " ").slice(0, 19)} UTC`;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 break-words text-sm text-ink">{value}</dd>
    </div>
  );
}

function PreBlock({ text }: { text: string }) {
  return (
    <pre className="mt-2 max-w-full overflow-x-auto rounded-xl bg-ink/95 p-4 text-xs leading-relaxed text-slate-100">
      {text}
    </pre>
  );
}

export default async function ErrorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("error_logs")
    .select(
      "id, occurred_at, surface, origin, severity, operation, message, stack, context, user_id, user_role, tenant_id, environment"
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();
  const row = data as ErrorLogRow;

  return (
    <DashboardShell
      panelName={strings.adminPanelName}
      navItems={adminNavItems}
      activeHref="/admin/errors"
      footer={<AdminSidebarFooter email={user?.email ?? ""} />}
    >
      <div className="p-8">
        <Link
          href="/admin/errors"
          className="text-sm font-medium text-brand underline underline-offset-2 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand rounded-sm"
        >
          {strings.errorLogDetailBackLabel}
        </Link>

        <h1 className="mt-4 text-2xl font-bold text-ink">
          {strings.errorLogDetailTitle}
        </h1>
        <p className="mt-1 break-all font-mono text-sm text-slate-500">
          {row.operation}
        </p>

        <div className="mt-6 rounded-2xl bg-surface p-6 shadow-sm">
          <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={strings.errorLogColTime} value={formatTime(row.occurred_at)} />
            <Field label={strings.errorLogColSeverity} value={row.severity} />
            <Field label={strings.errorLogColSurface} value={row.surface} />
            <Field label={strings.errorLogColOrigin} value={row.origin} />
            <Field
              label={strings.errorLogUserLabel}
              value={row.user_id ?? strings.errorLogAnonymous}
            />
            <Field label={strings.errorLogRoleLabel} value={row.user_role ?? "—"} />
            <Field label={strings.errorLogWaveLabel} value={row.tenant_id ?? "—"} />
            <Field
              label={strings.errorLogEnvironmentLabel}
              value={row.environment ?? "—"}
            />
          </dl>
        </div>

        <div className="mt-6 rounded-2xl bg-surface p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-ink">
            {strings.errorLogMessageLabel}
          </h2>
          <p className="mt-2 break-words text-sm text-slate-600">{row.message}</p>
        </div>

        <div className="mt-6 rounded-2xl bg-surface p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-ink">
            {strings.errorLogStackLabel}
          </h2>
          {row.stack ? (
            <PreBlock text={row.stack} />
          ) : (
            <p className="mt-2 text-sm text-slate-400">{strings.errorLogNoStack}</p>
          )}
        </div>

        <div className="mt-6 rounded-2xl bg-surface p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-ink">
            {strings.errorLogContextLabel}
          </h2>
          {row.context ? (
            <PreBlock text={JSON.stringify(row.context, null, 2)} />
          ) : (
            <p className="mt-2 text-sm text-slate-400">{strings.errorLogNoContext}</p>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
