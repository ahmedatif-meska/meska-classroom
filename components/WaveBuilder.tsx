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
  removeAssignment,
} from "@/app/admin/waves/actions";
import {
  validateWaveFields,
  validateMaterialFile,
  extensionForType,
  WAVE_TYPES,
} from "@/lib/waves/validation";
import {
  MATERIALS_BUCKET,
  materialPath,
  assignmentPath,
} from "@/lib/waves/files";
import { createClient } from "@/lib/supabase/client";
import RichTextEditor from "@/components/RichTextEditor";
import type { WaveRow, AdminWeek } from "@/lib/waves/content";
import strings from "@/lib/strings";

// ---------------------------------------------------------------------------
// One component, two modes:
//   • Create — empty client draft; a single Save writes the whole thing.
//   • Edit   — seeded from the saved wave; the SAME layout, pre-filled and
//     editable. Existing materials/assignments show as indicators with a Delete
//     (deletes hit the server immediately); every other change is applied by the
//     single Save.
// Materials AND assignments are bulk file uploads (filename = title); the only
// difference is which table/section they land in. Students still submit work to
// assignments separately.
// ---------------------------------------------------------------------------

type DraftFile = {
  key: string;
  title: string;
  file: File | null;
  saved: boolean;
  existingId?: string;
  url?: string | null;
};
type DraftWeek = {
  key: string;
  title: string;
  description: string;
  materials: DraftFile[];
  assignments: DraftFile[];
  savedId: string | null;
  existingId?: string;
};

const FILE_ACCEPT = ".pdf,.ppt,.pptx";

const labelClass =
  "block text-xs font-semibold uppercase tracking-wider text-slate-500";
const cardClass =
  "rounded-xl border border-slate-200 bg-surface/90 p-6 shadow-sm backdrop-blur-xl sm:p-8";
const inputClass =
  "w-full rounded-lg border-0 bg-slate-100 p-4 text-base text-ink placeholder:text-slate-400 outline-none transition-all focus:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const smallInputClass =
  "w-full rounded-lg border-0 bg-slate-100 p-3 text-base text-ink placeholder:text-slate-400 outline-none transition-all focus:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

// --- inline icons (decorative; labels carry the accessible name) ------------
const iconBase = "h-5 w-5";
function Icon({ d, className = iconBase }: { d: string; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {d.split("|").map((p) => (
        <path key={p} d={p} />
      ))}
    </svg>
  );
}
const ICONS = {
  wifi: "M2.808 9.308a13 13 0 0118.384 0|M5.636 12.136a9 9 0 0112.728 0|M8.464 14.964a5 5 0 017.072 0|M12 18.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z",
  wifiOff: "M18.364 18.364A9 9 0 005.636 5.636|M3 3l18 18",
  trash:
    "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
  file: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  upload: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12",
  clipboard:
    "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
  plus: "M12 4v16m8-8H4",
  x: "M6 18L18 6M6 6l12 12",
  play: "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z|M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
} as const;

const TYPE_LABELS: Record<(typeof WAVE_TYPES)[number], string> = {
  online: strings.waveTypeOnline,
  offline: strings.waveTypeOffline,
};

const fileEntry = (f: File): DraftFile => ({
  key: crypto.randomUUID(),
  title: f.name,
  file: f,
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
      file: null,
      saved: true,
      url: a.url,
    })),
  }));

/** The title text (linked when an uploaded URL exists). */
function FileTitle({ item }: { item: DraftFile }) {
  return item.url ? (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-brand hover:underline"
    >
      {item.title}
    </a>
  ) : (
    <>{item.title}</>
  );
}

/**
 * A bulk file uploader, used for materials (compact rows) and assignments
 * (cards). The file bytes upload browser→Storage on Save; the Server Action
 * only ever receives the object path.
 */
function FileSection({
  heading,
  items,
  addLabel,
  removeLabel,
  tone,
  onAdd,
  onRemove,
}: {
  heading: string;
  items: DraftFile[];
  addLabel: string;
  removeLabel: string;
  tone: "material" | "assignment";
  onAdd: (files: File[]) => void;
  onRemove: (item: DraftFile) => void;
}) {
  const fileInput = (
    <input
      type="file"
      multiple
      accept={FILE_ACCEPT}
      className="sr-only"
      onChange={(e) => {
        const files = Array.from(e.target.files ?? []);
        e.target.value = ""; // allow re-selecting the same file later
        if (files.length) onAdd(files);
      }}
    />
  );

  return (
    <div className="space-y-3">
      <label className={labelClass}>{heading}</label>
      <div className="space-y-2">
        {items.map((item) =>
          tone === "material" ? (
            <div
              key={item.key}
              className="flex items-center gap-3 rounded-lg border border-slate-200/60 bg-brand/5 p-3"
            >
              <Icon d={ICONS.file} className="h-5 w-5 shrink-0 text-brand" />
              <span className="min-w-0 flex-grow truncate text-sm font-medium text-ink">
                <FileTitle item={item} />
              </span>
              <button
                type="button"
                onClick={() => onRemove(item)}
                aria-label={removeLabel}
                title={removeLabel}
                className="shrink-0 rounded-full p-1 text-slate-500 transition-colors hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <Icon d={ICONS.x} className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div
              key={item.key}
              className="flex items-start justify-between gap-3 rounded-lg border border-slate-200/60 bg-surface p-4 shadow-sm"
            >
              <h5 className="min-w-0 break-words text-sm font-bold text-ink">
                <FileTitle item={item} />
              </h5>
              <button
                type="button"
                onClick={() => onRemove(item)}
                aria-label={removeLabel}
                title={removeLabel}
                className="shrink-0 rounded-full p-1 text-slate-500 transition-colors hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <Icon d={ICONS.x} className="h-4 w-4" />
              </button>
            </div>
          )
        )}

        {tone === "material" ? (
          <label className="group flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 py-3 text-slate-500 transition-colors hover:border-brand/50 hover:bg-brand/5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand">
            <Icon
              d={ICONS.upload}
              className="h-5 w-5 text-slate-500 group-hover:text-brand"
            />
            <span className="text-sm font-medium group-hover:text-brand">
              {addLabel}
            </span>
            {fileInput}
          </label>
        ) : (
          <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-brand/30 py-2.5 text-xs font-semibold text-brand transition-colors hover:bg-brand/5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand">
            <Icon d={ICONS.clipboard} className="h-4 w-4" />
            {addLabel}
            {fileInput}
          </label>
        )}
      </div>
      <p className="text-xs text-slate-500">{strings.materialFileHelp}</p>
    </div>
  );
}

/**
 * Video Links — VISUAL PLACEHOLDER ONLY. There is no backend for video links
 * (no column/table/action), so entries live in local state and are intentionally
 * NOT persisted on Save. Wiring real persistence needs a migration + action.
 */
function VideoLinksSection() {
  const [url, setUrl] = useState("");
  const [links, setLinks] = useState<string[]>([]);

  const add = () => {
    const v = url.trim();
    if (!v) return;
    setLinks((ls) => [...ls, v]);
    setUrl("");
  };

  return (
    <div className="space-y-3">
      <label className={labelClass} htmlFor="video-url">
        {strings.videoLinksLabel}
      </label>
      <div className="flex gap-2">
        <input
          id="video-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={strings.videoLinkPlaceholder}
          className="flex-grow rounded-lg border-0 bg-slate-100 px-4 py-2 text-sm text-ink placeholder:text-slate-400 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        />
        <button
          type="button"
          onClick={add}
          className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:brightness-110 active:scale-95"
        >
          {strings.videoAddLabel}
        </button>
      </div>
      {links.length > 0 ? (
        <ul className="space-y-2">
          {links.map((link, i) => (
            <li
              key={`${link}-${i}`}
              className="flex items-center gap-2 rounded-lg border border-brand/10 bg-brand/5 p-2.5 text-xs text-brand"
            >
              <Icon d={ICONS.play} className="h-4 w-4 shrink-0" />
              <span className="flex-grow truncate font-medium">{link}</span>
              <button
                type="button"
                onClick={() => setLinks((ls) => ls.filter((_, j) => j !== i))}
                aria-label={strings.videoRemoveLabel}
                title={strings.videoRemoveLabel}
                className="shrink-0 text-slate-500 transition-colors hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <Icon d={ICONS.x} className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

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

  const patchWeek = (key: string, patch: Partial<DraftWeek>) =>
    setWeeks((ws) => ws.map((w) => (w.key === key ? { ...w, ...patch } : w)));

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
  const removeFile = async (
    week: DraftWeek,
    item: DraftFile,
    field: "materials" | "assignments",
    action: typeof removeMaterial
  ) => {
    if (item.existingId) {
      const fd = new FormData();
      fd.set("id", item.existingId);
      fd.set("wave_id", waveIdRef.current ?? "");
      const r = await action({}, fd);
      if (!r.saved) return setError(r.error ?? strings.wavesMaterialSaveFailed);
    }
    patchWeek(week.key, {
      [field]: week[field].filter((x) => x.key !== item.key),
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

      const supabase = createClient();
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

        // Materials: upload each not-yet-saved file (filename = title). The
        // bytes go straight from the browser to Storage — Server Action request
        // bodies are capped (~4.5 MB on Vercel), so the action only receives
        // the uploaded object's path.
        for (const m of week.materials) {
          if (m.existingId || m.saved) continue;
          if (!m.file) {
            m.saved = true;
            continue;
          }
          const chk = validateMaterialFile({
            type: m.file.type,
            size: m.file.size,
          });
          if (!chk.ok) return fail(chk.error, working);
          const path = materialPath(
            waveId,
            week.savedId,
            crypto.randomUUID(),
            extensionForType(m.file.type)
          );
          const { error: upErr } = await supabase.storage
            .from(MATERIALS_BUCKET)
            .upload(path, m.file, { contentType: m.file.type, upsert: false });
          if (upErr) return fail(strings.wavesMaterialUploadFailed, working);
          const mfd = new FormData();
          mfd.set("wave_id", waveId);
          mfd.set("week_id", week.savedId);
          mfd.set("title", m.title);
          mfd.set("file_path", path);
          const mres = await addMaterial({}, mfd);
          if (!mres.saved)
            return fail(mres.error ?? strings.wavesMaterialSaveFailed, working);
          m.saved = true;
        }

        // Assignments: same as materials (the title is the original filename).
        for (const a of week.assignments) {
          if (a.existingId || a.saved) continue;
          if (!a.file) {
            a.saved = true;
            continue;
          }
          const chk = validateMaterialFile({
            type: a.file.type,
            size: a.file.size,
          });
          if (!chk.ok) return fail(chk.error, working);
          const path = assignmentPath(
            waveId,
            week.savedId,
            crypto.randomUUID(),
            extensionForType(a.file.type)
          );
          const { error: upErr } = await supabase.storage
            .from(MATERIALS_BUCKET)
            .upload(path, a.file, { contentType: a.file.type, upsert: false });
          if (upErr) return fail(strings.wavesMaterialUploadFailed, working);
          const afd = new FormData();
          afd.set("wave_id", waveId);
          afd.set("week_id", week.savedId);
          afd.set("title", a.title);
          afd.set("file_path", path);
          const ares = await addAssignment({}, afd);
          if (!ares.saved)
            return fail(ares.error ?? strings.wavesAssignmentSaveFailed, working);
          a.saved = true;
        }
      }

      router.push(redirectTo); // all persisted — leave pending true while navigating
    } catch (err) {
      // A thrown error here (vs. a returned one) means the Server Action request
      // itself failed — most often a file too large for the request body limit.
      // Surface the real reason instead of a generic, undebuggable message.
      const detail = err instanceof Error && err.message ? err.message : "";
      fail(detail ? `${strings.wavesSaveFailed} (${detail})` : strings.wavesSaveFailed);
    }
  };

  return (
    <div className="space-y-8 pb-28">
      {/* Basics */}
      <div className={`${cardClass} space-y-6`}>
        <div className="space-y-2">
          <label htmlFor="wave-name" className={labelClass}>
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

        <fieldset className="space-y-4">
          <legend className={labelClass}>{strings.waveTypeLabel} *</legend>
          <div className="flex flex-wrap gap-3">
            {WAVE_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={type === t}
                onClick={() => setType(t)}
                className={`flex items-center gap-2 rounded-full border-2 px-6 py-2.5 text-base font-semibold transition-all active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                  type === t
                    ? "border-brand bg-brand/10 text-brand shadow-sm"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Icon d={t === "online" ? ICONS.wifi : ICONS.wifiOff} />
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      {/* Weeks */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-ink">
            {strings.weeksSectionTitle}
          </h2>
          <button
            type="button"
            onClick={() => setWeeks((ws) => [...ws, newWeek()])}
            className="inline-flex items-center gap-2 rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand shadow-sm transition-colors hover:bg-brand/5 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <Icon d={ICONS.plus} className="h-4 w-4" />
            {strings.weekAddLabel}
          </button>
        </div>

        {weeks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-surface/60 px-4 py-6 text-sm text-slate-500">
            {strings.weeksEmptyNote}
          </p>
        ) : (
          weeks.map((week, wi) => (
            <section
              key={week.key}
              className="overflow-hidden rounded-xl border border-brand/20 bg-surface/90 shadow-md backdrop-blur-xl"
            >
              <header className="flex items-center justify-between gap-3 border-b border-slate-200/60 bg-brand/5 px-6 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                    {wi + 1}
                  </span>
                  <h4 className="text-base font-bold text-brand">
                    {strings.weekDefaultTitle} {wi + 1} {strings.weekDetailsLabel}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => void removeWeekRow(week)}
                  aria-label={strings.weekRemoveLabel}
                  title={strings.weekRemoveLabel}
                  className="rounded-full p-2 text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <Icon d={ICONS.trash} />
                </button>
              </header>

              <div className="space-y-6 p-6">
                <div className="space-y-2">
                  <label className={labelClass}>
                    {strings.weekTitleLabel} *
                  </label>
                  <input
                    type="text"
                    value={week.title}
                    onChange={(e) =>
                      patchWeek(week.key, { title: e.target.value })
                    }
                    placeholder={strings.weekTitlePlaceholder}
                    className={smallInputClass}
                  />
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>
                    {strings.weekDescriptionLabel}
                  </label>
                  <textarea
                    value={week.description}
                    onChange={(e) =>
                      patchWeek(week.key, { description: e.target.value })
                    }
                    rows={3}
                    placeholder={strings.weekDescriptionLabel}
                    className={`${smallInputClass} min-h-[100px] resize-y text-sm`}
                  />
                </div>

                <FileSection
                  heading={strings.studentMaterialsLabel}
                  items={week.materials}
                  addLabel={strings.materialUploadLabel}
                  removeLabel={strings.materialRemoveLabel}
                  tone="material"
                  onAdd={(files) =>
                    patchWeek(week.key, {
                      materials: [...week.materials, ...files.map(fileEntry)],
                    })
                  }
                  onRemove={(item) =>
                    void removeFile(week, item, "materials", removeMaterial)
                  }
                />

                <FileSection
                  heading={strings.studentAssignmentsLabel}
                  items={week.assignments}
                  addLabel={strings.assignmentAddLabel}
                  removeLabel={strings.assignmentRemoveLabel}
                  tone="assignment"
                  onAdd={(files) =>
                    patchWeek(week.key, {
                      assignments: [
                        ...week.assignments,
                        ...files.map(fileEntry),
                      ],
                    })
                  }
                  onRemove={(item) =>
                    void removeFile(week, item, "assignments", removeAssignment)
                  }
                />

                <VideoLinksSection />
              </div>
            </section>
          ))
        )}

        {weeks.length > 0 ? (
          <button
            type="button"
            onClick={() => setWeeks((ws) => [...ws, newWeek()])}
            className="group flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-6 text-center transition-all hover:border-brand/60 hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-slate-500 transition-colors group-hover:bg-brand/10 group-hover:text-brand">
              <Icon d={ICONS.plus} />
            </span>
            <span className="text-sm font-semibold text-slate-500 group-hover:text-brand">
              {strings.weekAddNumberedPrefix} {weeks.length + 1}
            </span>
          </button>
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {error}
        </p>
      ) : null}

      {/* Sticky Save bar — bleeds to the main edges past the page's padding. */}
      <div className="sticky bottom-0 z-40 -mx-8 -mb-8 border-t border-slate-200/40 bg-surface/80 px-8 py-4 shadow-lg backdrop-blur-md">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="w-full rounded-xl bg-brand py-3.5 text-lg font-bold text-white shadow-md transition-all duration-150 hover:brightness-110 active:scale-[0.99] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {pending
            ? strings.waveFormSubmittingLabel
            : strings.waveFormSubmitLabel}
        </button>
      </div>
    </div>
  );
}
