"use client";

import { useActionState, useRef, useState } from "react";
import {
  createMember,
  bulkCreateMembers,
  type CreateMemberState,
  type BulkCreateState,
} from "@/app/admin/members/actions";
import { parseAndValidateMembersCsv } from "@/lib/members/csv";
import strings from "@/lib/strings";

type Wave = { id: string; name: string };

const inputClass =
  "rounded-2xl border border-slate-200 bg-page px-4 py-3 text-base text-ink placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

const initialCreate: CreateMemberState = {};
const initialBulk: BulkCreateState = {};

function WaveSelect({ waves }: { waves: Wave[] }) {
  return (
    <select
      id="wave_id"
      name="wave_id"
      required
      defaultValue=""
      className={inputClass}
    >
      <option value="" disabled>
        {strings.memberWavePlaceholder}
      </option>
      {waves.map((w) => (
        <option key={w.id} value={w.id}>
          {w.name}
        </option>
      ))}
    </select>
  );
}

export default function AddMembersModal({ waves }: { waves: Wave[] }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"chooser" | "form" | "bulk">("chooser");

  // Single-add form.
  const [formState, formAction, formPending] = useActionState(
    async (prev: CreateMemberState, fd: FormData) => {
      const result = await createMember(prev, fd);
      if (result.created && !result.inviteFailed) close();
      return result;
    },
    initialCreate
  );

  // Bulk upload.
  const fileRef = useRef<HTMLInputElement>(null);
  const [bulkStep, setBulkStep] = useState<"upload" | "confirm">("upload");
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvCount, setCsvCount] = useState(0);
  const [bulkState, bulkAction, bulkPending] = useActionState(
    bulkCreateMembers,
    initialBulk
  );

  function reset() {
    setMode("chooser");
    setBulkStep("upload");
    setCsvError(null);
    setCsvCount(0);
  }

  function close() {
    setOpen(false);
    reset();
  }

  async function validateCsv() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setCsvError(strings.bulkInvalidCsv);
      return;
    }
    const text = await file.text();
    const parsed = parseAndValidateMembersCsv(text);
    if (!parsed.ok) {
      const rows = parsed.badRows?.length ? ` ${parsed.badRows.join(", ")}` : "";
      setCsvError(`${parsed.error}${rows}`);
      return;
    }
    setCsvError(null);
    setCsvCount(parsed.rows.length);
    setBulkStep("confirm");
  }

  const title =
    mode === "form"
      ? strings.memberFormTitle
      : mode === "bulk"
        ? strings.bulkUploadOption
        : strings.addMembersChooserTitle;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {strings.membersAddLabel}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-members-title"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-6 shadow-lg sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <h2 id="add-members-title" className="text-xl font-bold text-ink">
                {title}
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label={strings.closeLabel}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                ✕
              </button>
            </div>

            {/* Chooser */}
            {mode === "chooser" ? (
              <div className="mt-2">
                <p className="text-sm text-slate-500">
                  {strings.addMembersChooserSubtitle}
                </p>
                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setMode("form")}
                    className="rounded-2xl border border-slate-200 p-5 text-left hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    <span className="block font-semibold text-ink">
                      {strings.addMemberFormOption}
                    </span>
                    <span className="mt-1 block text-sm text-slate-500">
                      {strings.addMemberFormOptionHelp}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("bulk")}
                    className="rounded-2xl border border-slate-200 p-5 text-left hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    <span className="block font-semibold text-ink">
                      {strings.bulkUploadOption}
                    </span>
                    <span className="mt-1 block text-sm text-slate-500">
                      {strings.bulkUploadOptionHelp}
                    </span>
                  </button>
                </div>
              </div>
            ) : null}

            {/* Single-add form */}
            {mode === "form" ? (
              <>
                <p className="mt-1 text-sm text-slate-500">
                  {strings.memberFormSubtitle}
                </p>

                {formState.created && formState.inviteFailed ? (
                  <p
                    role="alert"
                    className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800"
                  >
                    {strings.memberInviteNotSent}
                  </p>
                ) : null}

                {formState.error ? (
                  <p
                    role="alert"
                    className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                  >
                    {formState.error}
                  </p>
                ) : null}

                <form action={formAction} className="mt-6 flex flex-col gap-5">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="full_name" className="text-sm font-bold text-ink">
                      {strings.memberFullNameLabel} *
                    </label>
                    <input
                      id="full_name"
                      name="full_name"
                      type="text"
                      required
                      autoComplete="name"
                      className={inputClass}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="whatsapp" className="text-sm font-bold text-ink">
                      {strings.memberWhatsappLabel} *
                    </label>
                    <input
                      id="whatsapp"
                      name="whatsapp"
                      type="tel"
                      required
                      autoComplete="tel"
                      placeholder={strings.memberWhatsappPlaceholder}
                      className={inputClass}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="email" className="text-sm font-bold text-ink">
                      {strings.emailLabel} *
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder={strings.emailPlaceholder}
                      className={inputClass}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="wave_id" className="text-sm font-bold text-ink">
                      {strings.memberWaveLabel} *
                    </label>
                    <WaveSelect waves={waves} />
                  </div>

                  <div className="mt-2 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={close}
                      className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-ink hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      {strings.cancelLabel}
                    </button>
                    <button
                      type="submit"
                      disabled={formPending}
                      className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
                    >
                      {formPending
                        ? strings.memberFormSubmittingLabel
                        : strings.memberFormSubmitLabel}
                    </button>
                  </div>
                </form>
              </>
            ) : null}

            {/* Bulk upload */}
            {mode === "bulk" ? (
              bulkState.results ? (
                <div className="mt-4">
                  <p className="text-sm font-medium text-ink">
                    {bulkState.createdCount} {strings.bulkCreatedLabel}
                    {bulkState.results.some((r) => !r.created)
                      ? ` · ${bulkState.results.filter((r) => !r.created).length} ${strings.bulkSkippedLabel}`
                      : ""}
                  </p>
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={close}
                      className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      {strings.bulkDoneLabel}
                    </button>
                  </div>
                </div>
              ) : (
                <form action={bulkAction} className="mt-4 flex flex-col gap-5">
                  <div
                    className={`flex flex-col gap-2 ${bulkStep === "confirm" ? "hidden" : ""}`}
                  >
                    <label htmlFor="file" className="text-sm font-bold text-ink">
                      {strings.bulkFileLabel}
                    </label>
                    <input
                      ref={fileRef}
                      id="file"
                      name="file"
                      type="file"
                      accept=".csv,text/csv"
                      className="text-sm text-ink file:mr-3 file:rounded-full file:border-0 file:bg-brand/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand"
                    />
                    <p className="text-xs text-slate-500">{strings.bulkFileHelp}</p>
                  </div>

                  {csvError ? (
                    <p
                      role="alert"
                      className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                    >
                      {csvError}
                    </p>
                  ) : null}

                  {bulkState.error ? (
                    <p
                      role="alert"
                      className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                    >
                      {bulkState.error}
                    </p>
                  ) : null}

                  {bulkStep === "confirm" ? (
                    <>
                      <p className="text-sm text-slate-500">
                        {csvCount} {strings.bulkReadyNote}. {strings.bulkChooseWaveSubtitle}
                      </p>
                      <div className="flex flex-col gap-2">
                        <label
                          htmlFor="wave_id"
                          className="text-sm font-bold text-ink"
                        >
                          {strings.bulkChooseWaveTitle} *
                        </label>
                        <WaveSelect waves={waves} />
                      </div>
                    </>
                  ) : null}

                  <div className="mt-2 flex justify-end gap-3">
                    {bulkStep === "confirm" ? (
                      <button
                        type="button"
                        onClick={() => setBulkStep("upload")}
                        className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-ink hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                      >
                        {strings.bulkBackLabel}
                      </button>
                    ) : null}

                    {bulkStep === "upload" ? (
                      <button
                        type="button"
                        onClick={validateCsv}
                        className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                      >
                        {strings.bulkValidateLabel}
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={bulkPending}
                        className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
                      >
                        {bulkPending
                          ? strings.bulkSubmittingLabel
                          : strings.bulkSubmitLabel}
                      </button>
                    )}
                  </div>
                </form>
              )
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
