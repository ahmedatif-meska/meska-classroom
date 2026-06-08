"use client";

import { useActionState, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  addWeek,
  removeWeek,
  addMaterial,
  removeMaterial,
  addAssignment,
  removeAssignment,
} from "@/app/admin/waves/actions";
import type { AdminWeek } from "@/lib/waves/content";
import strings from "@/lib/strings";

export type {
  AdminWeek,
  AdminAssignment,
  AdminMaterial,
  AdminSubmission,
} from "@/lib/waves/content";

type ActionFn = (
  prev: { error?: string; saved?: boolean },
  fd: FormData
) => Promise<{ error?: string; saved?: boolean }>;

const inputClass =
  "rounded-xl border border-slate-200 bg-page px-3 py-2 text-base text-ink placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

/**
 * One server-action-backed form with pending state + inline error. On success it
 * resets the form and refreshes the route so server-rendered content (and freshly
 * signed download URLs) re-flow in.
 */
function MutationForm({
  action,
  submitLabel,
  pendingLabel,
  children,
  className,
  compact,
  onDone,
}: {
  action: ActionFn;
  submitLabel: string;
  pendingLabel?: string;
  children?: ReactNode;
  className?: string;
  compact?: boolean;
  onDone: () => void;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    async (prev: { error?: string; saved?: boolean }, fd: FormData) => {
      const result = await action(prev, fd);
      if (result.saved) {
        ref.current?.reset();
        onDone();
      }
      return result;
    },
    {}
  );

  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      {state.error ? (
        <p
          role="alert"
          className="mt-1 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
        >
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className={
          compact
            ? "rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
            : "mt-1 self-start rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
        }
      >
        {pending ? (pendingLabel ?? submitLabel) : submitLabel}
      </button>
    </form>
  );
}

/** Admin view-only render of already-sanitized stored HTML. */
function Html({ html }: { html: string }) {
  return (
    <div
      className="instructor-rte mt-1 text-sm text-ink"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * Admin weeks/materials/assignments manager for one wave (client). All mutations
 * are admin-gated Server Actions; signed download URLs are produced server-side
 * and passed in as props.
 */
export default function WaveWeeks({
  waveId,
  weeks,
  onMutated,
}: {
  waveId: string;
  weeks: AdminWeek[];
  /** Called after each successful mutation. Defaults to a full route refresh
      (server-rendered detail page); the in-page builder passes a re-fetch instead. */
  onMutated?: () => void;
}) {
  const router = useRouter();
  const refresh = onMutated ?? (() => router.refresh());
  return (
    <div className="mt-8">
      <h2 className="text-lg font-bold text-ink">{strings.weeksSectionTitle}</h2>

      {/* Add week */}
      <MutationForm
        action={addWeek}
        onDone={refresh}
        submitLabel={strings.weekAddLabel}
        pendingLabel={strings.weekAddLabel}
        className="mt-3 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-surface p-4"
      >
        <input type="hidden" name="wave_id" value={waveId} />
        <input
          name="title"
          type="text"
          placeholder={strings.weekTitlePlaceholder}
          className={inputClass}
        />
        <textarea
          name="description_html"
          rows={2}
          placeholder={strings.weekDescriptionLabel}
          className={inputClass}
        />
      </MutationForm>

      {weeks.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">{strings.weeksEmptyNote}</p>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {weeks.map((week) => (
            <section
              key={week.id}
              className="rounded-2xl border border-slate-200 bg-surface p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-bold text-ink">
                  {week.title || `${strings.weekDefaultTitle} ${week.position}`}
                </h3>
                <MutationForm
                  action={removeWeek}
                  onDone={refresh}
                  submitLabel={strings.weekRemoveLabel}
                  compact
                >
                  <input type="hidden" name="id" value={week.id} />
                  <input type="hidden" name="wave_id" value={waveId} />
                </MutationForm>
              </div>
              {week.description_html ? <Html html={week.description_html} /> : null}

              {/* Materials */}
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-slate-500">
                  {strings.studentMaterialsLabel}
                </h4>
                {week.materials.length === 0 ? (
                  <p className="mt-1 text-sm text-slate-400">
                    {strings.materialsEmptyNote}
                  </p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-1">
                    {week.materials.map((m) => (
                      <li
                        key={m.id}
                        className="flex items-center justify-between gap-3"
                      >
                        {m.url ? (
                          <a
                            href={m.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-brand hover:underline"
                          >
                            {m.title} — {strings.materialDownloadLabel}
                          </a>
                        ) : (
                          <span className="text-sm text-ink">{m.title}</span>
                        )}
                        <MutationForm
                          action={removeMaterial}
                          onDone={refresh}
                          submitLabel={strings.materialRemoveLabel}
                          compact
                        >
                          <input type="hidden" name="id" value={m.id} />
                          <input type="hidden" name="wave_id" value={waveId} />
                        </MutationForm>
                      </li>
                    ))}
                  </ul>
                )}
                <MutationForm
                  action={addMaterial}
                  onDone={refresh}
                  submitLabel={strings.materialAddLabel}
                  className="mt-3 flex flex-col gap-2"
                >
                  <input type="hidden" name="wave_id" value={waveId} />
                  <input type="hidden" name="week_id" value={week.id} />
                  <input
                    name="title"
                    type="text"
                    placeholder={strings.materialTitleLabel}
                    className={inputClass}
                  />
                  <input
                    name="file"
                    type="file"
                    accept=".pdf,.ppt,.pptx"
                    className="text-sm text-ink file:mr-3 file:rounded-full file:border-0 file:bg-brand/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand"
                  />
                  <p className="text-xs text-slate-500">
                    {strings.materialFileHelp}
                  </p>
                </MutationForm>
              </div>

              {/* Assignments */}
              <div className="mt-5">
                <h4 className="text-sm font-semibold text-slate-500">
                  {strings.studentAssignmentsLabel}
                </h4>
                {week.assignments.length === 0 ? (
                  <p className="mt-1 text-sm text-slate-400">
                    {strings.assignmentsEmptyNote}
                  </p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-3">
                    {week.assignments.map((a) => (
                      <li
                        key={a.id}
                        className="rounded-xl border border-slate-100 bg-page p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-semibold text-ink">{a.title}</p>
                          <MutationForm
                            action={removeAssignment}
                            onDone={refresh}
                            submitLabel={strings.assignmentRemoveLabel}
                            compact
                          >
                            <input type="hidden" name="id" value={a.id} />
                            <input type="hidden" name="wave_id" value={waveId} />
                          </MutationForm>
                        </div>
                        {a.due_at ? (
                          <p className="mt-1 text-xs text-slate-500">
                            {strings.assignmentDueLabel}:{" "}
                            {new Date(a.due_at).toLocaleDateString()}
                          </p>
                        ) : null}
                        {a.instructions_html ? (
                          <Html html={a.instructions_html} />
                        ) : null}

                        <p className="mt-3 text-xs font-semibold text-slate-500">
                          {strings.assignmentSubmissionsLabel}
                        </p>
                        {a.submissions.length === 0 ? (
                          <p className="text-xs text-slate-400">
                            {strings.assignmentNoSubmissions}
                          </p>
                        ) : (
                          <ul className="mt-1 flex flex-col gap-1">
                            {a.submissions.map((s, i) => (
                              <li key={i} className="text-sm text-ink">
                                {s.studentName}
                                {s.url ? (
                                  <>
                                    {" — "}
                                    <a
                                      href={s.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-medium text-brand hover:underline"
                                    >
                                      {strings.materialDownloadLabel}
                                    </a>
                                  </>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <MutationForm
                  action={addAssignment}
                  onDone={refresh}
                  submitLabel={strings.assignmentAddLabel}
                  className="mt-3 flex flex-col gap-2"
                >
                  <input type="hidden" name="wave_id" value={waveId} />
                  <input type="hidden" name="week_id" value={week.id} />
                  <input
                    name="title"
                    type="text"
                    placeholder={strings.assignmentTitleLabel}
                    className={inputClass}
                  />
                  <textarea
                    name="instructions_html"
                    rows={2}
                    placeholder={strings.assignmentInstructionsLabel}
                    className={inputClass}
                  />
                  <label className="text-xs font-semibold text-slate-500">
                    {strings.assignmentDueLabel}
                    <input
                      name="due_at"
                      type="datetime-local"
                      className={`${inputClass} mt-1 block w-full`}
                    />
                  </label>
                </MutationForm>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
