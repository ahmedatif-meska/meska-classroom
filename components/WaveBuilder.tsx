"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createWave,
  updateWave,
  addWeek,
  updateWeek,
  removeWeek,
  addMaterial,
  removeMaterial,
  addAssignment,
  updateAssignment,
  removeAssignment,
} from "@/app/admin/waves/actions";
import {
  validateWaveFields,
  validateMaterialFile,
  WAVE_TYPES,
} from "@/lib/waves/validation";
import RichTextEditor from "@/components/RichTextEditor";
import type { WaveRow, AdminWeek } from "@/lib/waves/content";
import strings from "@/lib/strings";

// ---------------------------------------------------------------------------
// One component, two modes:
//   • Create — empty client draft; a single Save writes the whole thing.
//   • Edit   — seeded from the saved wave; the SAME layout, pre-filled and
//     editable. Existing materials/assignments show as indicators with a Delete
//     (deletes hit the server immediately); every other change (basics, week
//     fields, new weeks/materials/assignments) is applied by the single Save.
// `saved`/`savedId`/`existingId` flags make Save resumable and let it tell new
// items (insert) from existing ones (update / leave).
// ---------------------------------------------------------------------------

type DraftMaterial = {
  key: string;
  title: string;
  file: File | null;
  saved: boolean;
  existingId?: string;
  url?: string | null;
};
type DraftAssignment = {
  key: string;
  title: string;
  instructions: string;
  dueAt: string;
  saved: boolean;
  existingId?: string;
};
type DraftWeek = {
  key: string;
  title: string;
  description: string;
  materials: DraftMaterial[];
  assignments: DraftAssignment[];
  savedId: string | null;
  existingId?: string;
};

const inputClass =
  "rounded-2xl border border-slate-200 bg-page px-4 py-3 text-base text-ink placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const smallInputClass =
  "rounded-xl border border-slate-200 bg-page px-3 py-2 text-base text-ink placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const removeBtnClass =
  "shrink-0 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60";

const TYPE_LABELS: Record<(typeof WAVE_TYPES)[number], string> = {
  online: strings.waveTypeOnline,
  offline: strings.waveTypeOffline,
};

const newMaterial = (): DraftMaterial => ({
  key: crypto.randomUUID(),
  title: "",
  file: null,
  saved: false,
});
const newAssignment = (): DraftAssignment => ({
  key: crypto.randomUUID(),
  title: "",
  instructions: "",
  dueAt: "",
  saved: false,
});
const newWeek = (): DraftWeek => ({
  key: crypto.randomUUID(),
  title: "",
  description: "",
  materials: [],
  assignments: [],
  savedId: null,
});

/** An ISO timestamp → the local value a <input type="datetime-local"> expects. */
const toLocalInput = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};

/** Seed the draft from saved content (edit mode). */
const seedWeeks = (ws: AdminWeek[]): DraftWeek[] =>
  ws.map((w) => ({
    key: w.id,
    existingId: w.id,
    savedId: w.id,
    title: w.title ?? "",
    description: w.description_html ?? "",
    materials: w.materials.map((m) => ({
      key: m.id,
      existingId: m.id,
      title: m.title,
      file: null,
      saved: true,
      url: m.url,
    })),
    assignments: w.assignments.map((a) => ({
      key: a.id,
      existingId: a.id,
      title: a.title,
      instructions: a.instructions_html ?? "",
      dueAt: toLocalInput(a.due_at),
      saved: true,
    })),
  }));

export default function WaveBuilder({
  redirectTo = "/admin/waves",
  existing,
}: {
  /** Where to go after a successful Save. The add-member flow returns to its
      form (re-opening the modal) so the new wave can be assigned right away. */
  redirectTo?: string;
  /** Present ⇒ edit an existing wave (the page is pre-filled and editable). */
  existing?: { wave: WaveRow; weeks: AdminWeek[] };
}) {
  const router = useRouter();
  const [name, setName] = useState(existing?.wave.name ?? "");
  const [type, setType] = useState<"online" | "offline" | "">(
    existing?.wave.type ?? ""
  );
  const [html, setHtml] = useState(existing?.wave.description_html ?? "");
  const [weeks, setWeeks] = useState<DraftWeek[]>(() =>
    existing ? seedWeeks(existing.weeks) : []
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Survives Save retries so a created wave is never created twice.
  const waveIdRef = useRef<string | null>(existing?.wave.id ?? null);

  // --- nested draft updaters -------------------------------------------------
  const patchWeek = (key: string, patch: Partial<DraftWeek>) =>
    setWeeks((ws) => ws.map((w) => (w.key === key ? { ...w, ...patch } : w)));
  const patchMaterial = (wk: string, mk: string, patch: Partial<DraftMaterial>) =>
    setWeeks((ws) =>
      ws.map((w) =>
        w.key === wk
          ? {
              ...w,
              materials: w.materials.map((m) =>
                m.key === mk ? { ...m, ...patch } : m
              ),
            }
          : w
      )
    );
  const patchAssignment = (
    wk: string,
    ak: string,
    patch: Partial<DraftAssignment>
  ) =>
    setWeeks((ws) =>
      ws.map((w) =>
        w.key === wk
          ? {
              ...w,
              assignments: w.assignments.map((a) =>
                a.key === ak ? { ...a, ...patch } : a
              ),
            }
          : w
      )
    );

  // --- immediate deletes (existing items hit the server, new ones are local) -
  const removeWeekRow = async (week: DraftWeek) => {
    if (week.existingId) {
      const fd = new FormData();
      fd.set("id", week.existingId);
      fd.set("wave_id", waveIdRef.current ?? "");
      const r = await removeWeek({}, fd);
      if (!r.saved) return setError(r.error ?? strings.wavesWeekSaveFailed);
    }
    setWeeks((ws) => ws.filter((w) => w.key !== week.key));
  };
  const removeMaterialRow = async (week: DraftWeek, m: DraftMaterial) => {
    if (m.existingId) {
      const fd = new FormData();
      fd.set("id", m.existingId);
      fd.set("wave_id", waveIdRef.current ?? "");
      const r = await removeMaterial({}, fd);
      if (!r.saved) return setError(r.error ?? strings.wavesMaterialSaveFailed);
    }
    patchWeek(week.key, {
      materials: week.materials.filter((x) => x.key !== m.key),
    });
  };
  const removeAssignmentRow = async (week: DraftWeek, a: DraftAssignment) => {
    if (a.existingId) {
      const fd = new FormData();
      fd.set("id", a.existingId);
      fd.set("wave_id", waveIdRef.current ?? "");
      const r = await removeAssignment({}, fd);
      if (!r.saved)
        return setError(r.error ?? strings.wavesAssignmentSaveFailed);
    }
    patchWeek(week.key, {
      assignments: week.assignments.filter((x) => x.key !== a.key),
    });
  };

  // --- batched, resumable Save ----------------------------------------------
  const handleSave = async () => {
    const pre = validateWaveFields(name, type);
    if (!pre.ok) {
      setError(pre.error);
      return;
    }
    setError(null);
    setPending(true);

    const fail = (msg: string, working?: DraftWeek[]) => {
      if (working) setWeeks(working);
      setError(msg);
      setPending(false);
    };

    try {
      // 1) Wave — create when new, update when it already exists.
      let waveId = waveIdRef.current;
      const basics = new FormData();
      basics.set("name", name.trim());
      basics.set("type", type);
      basics.set("description_html", html);
      if (!waveId) {
        const res = await createWave({}, basics);
        if (!res.wave) return fail(res.error ?? strings.wavesSaveFailed);
        waveId = res.wave.id;
        waveIdRef.current = waveId;
      } else {
        basics.set("id", waveId);
        const res = await updateWave({}, basics);
        if (!res.saved) return fail(res.error ?? strings.wavesSaveFailed);
      }

      // 2) Weeks → materials → assignments, in order. Work on a copy so progress
      //    flags persist to state if a step fails (for a clean retry).
      const working = weeks.map((w) => ({
        ...w,
        materials: w.materials.map((m) => ({ ...m })),
        assignments: w.assignments.map((a) => ({ ...a })),
      }));

      for (const week of working) {
        if (!week.savedId) {
          const wfd = new FormData();
          wfd.set("wave_id", waveId);
          wfd.set("title", week.title);
          wfd.set("description_html", week.description);
          const wres = await addWeek({}, wfd);
          if (!wres.id) return fail(strings.wavesWeekSaveFailed, working);
          week.savedId = wres.id;
        } else {
          const wfd = new FormData();
          wfd.set("id", week.savedId);
          wfd.set("wave_id", waveId);
          wfd.set("title", week.title);
          wfd.set("description_html", week.description);
          const wres = await updateWeek({}, wfd);
          if (!wres.saved) return fail(strings.wavesWeekSaveFailed, working);
        }

        for (const m of week.materials) {
          if (m.existingId || m.saved) continue; // already stored — never re-upload
          if (!m.title.trim() && !m.file) {
            m.saved = true;
            continue;
          }
          if (!m.title.trim() || !m.file)
            return fail(strings.wavesMaterialSaveFailed, working);
          const chk = validateMaterialFile({
            type: m.file.type,
            size: m.file.size,
          });
          if (!chk.ok) return fail(chk.error, working);
          const mfd = new FormData();
          mfd.set("wave_id", waveId);
          mfd.set("week_id", week.savedId);
          mfd.set("title", m.title.trim());
          mfd.set("file", m.file);
          const mres = await addMaterial({}, mfd);
          if (!mres.saved)
            return fail(mres.error ?? strings.wavesMaterialSaveFailed, working);
          m.saved = true;
        }

        for (const a of week.assignments) {
          if (a.existingId) {
            const afd = new FormData();
            afd.set("id", a.existingId);
            afd.set("wave_id", waveId);
            afd.set("title", a.title.trim());
            afd.set("instructions_html", a.instructions);
            afd.set("due_at", a.dueAt);
            const ares = await updateAssignment({}, afd);
            if (!ares.saved)
              return fail(
                ares.error ?? strings.wavesAssignmentSaveFailed,
                working
              );
            continue;
          }
          if (a.saved) continue;
          if (!a.title.trim()) {
            if (!a.instructions.trim() && !a.dueAt) {
              a.saved = true;
              continue;
            }
            return fail(strings.wavesAssignmentSaveFailed, working);
          }
          const afd = new FormData();
          afd.set("wave_id", waveId);
          afd.set("week_id", week.savedId);
          afd.set("title", a.title.trim());
          afd.set("instructions_html", a.instructions);
          afd.set("due_at", a.dueAt);
          const ares = await addAssignment({}, afd);
          if (!ares.saved)
            return fail(ares.error ?? strings.wavesAssignmentSaveFailed, working);
          a.saved = true;
        }
      }

      router.push(redirectTo); // all persisted — leave pending true while navigating
    } catch {
      fail(strings.wavesSaveFailed);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Basics */}
      <div className="max-w-2xl rounded-2xl border border-slate-200 bg-surface p-6 sm:p-8">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="wave-name" className="text-sm font-bold text-ink">
              {strings.waveNameLabel} *
            </label>
            <input
              id="wave-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={strings.waveNamePlaceholder}
              className={inputClass}
            />
          </div>

          <RichTextEditor
            name="description_html"
            label={strings.waveDescriptionLabel}
            initialHtml={existing?.wave.description_html ?? ""}
            onChange={setHtml}
          />

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-bold text-ink">
              {strings.waveTypeLabel} *
            </legend>
            <div className="flex flex-wrap gap-3">
              {WAVE_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={type === t}
                  onClick={() => setType(t)}
                  className={`rounded-full border px-5 py-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                    type === t
                      ? "border-brand bg-brand/10 text-brand"
                      : "border-slate-200 text-ink hover:bg-slate-50"
                  }`}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      </div>

      {/* Weeks */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">
            {strings.weeksSectionTitle}
          </h2>
          <button
            type="button"
            onClick={() => setWeeks((ws) => [...ws, newWeek()])}
            className="rounded-full border border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-brand/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            + {strings.weekAddLabel}
          </button>
        </div>

        {weeks.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-surface px-4 py-6 text-sm text-slate-500">
            {strings.weeksEmptyNote}
          </p>
        ) : (
          weeks.map((week, wi) => (
            <section
              key={week.key}
              className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-surface p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {strings.weekDefaultTitle} {wi + 1}
                </span>
                <button
                  type="button"
                  onClick={() => void removeWeekRow(week)}
                  className={removeBtnClass}
                >
                  {strings.weekRemoveLabel}
                </button>
              </div>

              <input
                type="text"
                value={week.title}
                onChange={(e) => patchWeek(week.key, { title: e.target.value })}
                placeholder={strings.weekTitlePlaceholder}
                className={smallInputClass}
              />
              <textarea
                value={week.description}
                onChange={(e) =>
                  patchWeek(week.key, { description: e.target.value })
                }
                rows={2}
                placeholder={strings.weekDescriptionLabel}
                className={smallInputClass}
              />

              {/* Materials */}
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-semibold text-slate-500">
                  {strings.studentMaterialsLabel}
                </h4>
                {week.materials.map((m) =>
                  m.existingId ? (
                    // Already uploaded — an indicator it exists, plus Delete.
                    <div
                      key={m.key}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-page p-3"
                    >
                      <span className="min-w-0 truncate text-sm text-ink">
                        📄{" "}
                        {m.url ? (
                          <a
                            href={m.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-brand hover:underline"
                          >
                            {m.title}
                          </a>
                        ) : (
                          m.title
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => void removeMaterialRow(week, m)}
                        className={removeBtnClass}
                      >
                        {strings.materialRemoveLabel}
                      </button>
                    </div>
                  ) : (
                    <div
                      key={m.key}
                      className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-page p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <input
                          type="text"
                          value={m.title}
                          onChange={(e) =>
                            patchMaterial(week.key, m.key, {
                              title: e.target.value,
                            })
                          }
                          placeholder={strings.materialTitleLabel}
                          className={`${smallInputClass} flex-1`}
                        />
                        <button
                          type="button"
                          onClick={() => void removeMaterialRow(week, m)}
                          className={removeBtnClass}
                        >
                          {strings.materialRemoveLabel}
                        </button>
                      </div>
                      <input
                        type="file"
                        accept=".pdf,.ppt,.pptx"
                        onChange={(e) =>
                          patchMaterial(week.key, m.key, {
                            file: e.target.files?.[0] ?? null,
                          })
                        }
                        className="text-sm text-ink file:mr-3 file:rounded-full file:border-0 file:bg-brand/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand"
                      />
                      <p className="text-xs text-slate-500">
                        {strings.materialFileHelp}
                      </p>
                    </div>
                  )
                )}
                <button
                  type="button"
                  onClick={() =>
                    patchWeek(week.key, {
                      materials: [...week.materials, newMaterial()],
                    })
                  }
                  className="self-start rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-ink hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  + {strings.materialAddLabel}
                </button>
              </div>

              {/* Assignments */}
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-semibold text-slate-500">
                  {strings.studentAssignmentsLabel}
                </h4>
                {week.assignments.map((a) => (
                  <div
                    key={a.key}
                    className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-page p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <input
                        type="text"
                        value={a.title}
                        onChange={(e) =>
                          patchAssignment(week.key, a.key, {
                            title: e.target.value,
                          })
                        }
                        placeholder={strings.assignmentTitleLabel}
                        className={`${smallInputClass} flex-1`}
                      />
                      <button
                        type="button"
                        onClick={() => void removeAssignmentRow(week, a)}
                        className={removeBtnClass}
                      >
                        {strings.assignmentRemoveLabel}
                      </button>
                    </div>
                    <textarea
                      value={a.instructions}
                      onChange={(e) =>
                        patchAssignment(week.key, a.key, {
                          instructions: e.target.value,
                        })
                      }
                      rows={2}
                      placeholder={strings.assignmentInstructionsLabel}
                      className={smallInputClass}
                    />
                    <label className="text-xs font-semibold text-slate-500">
                      {strings.assignmentDueLabel}
                      <input
                        type="datetime-local"
                        value={a.dueAt}
                        onChange={(e) =>
                          patchAssignment(week.key, a.key, {
                            dueAt: e.target.value,
                          })
                        }
                        className={`${smallInputClass} mt-1 block w-full`}
                      />
                    </label>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    patchWeek(week.key, {
                      assignments: [...week.assignments, newAssignment()],
                    })
                  }
                  className="self-start rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-ink hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  + {strings.assignmentAddLabel}
                </button>
              </div>
            </section>
          ))
        )}
      </div>

      {/* Save — end of page */}
      <div className="flex max-w-2xl flex-col gap-3">
        {error ? (
          <p
            role="alert"
            className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="self-start rounded-full bg-brand px-8 py-3 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
        >
          {pending
            ? strings.waveFormSubmittingLabel
            : strings.waveFormSubmitLabel}
        </button>
      </div>
    </div>
  );
}
