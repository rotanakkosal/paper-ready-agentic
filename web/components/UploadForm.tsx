"use client";

import { useState, type FormEvent } from "react";
import JournalSelect from "./JournalSelect";
import type { ValidationReport, ApiError } from "@/lib/types";

type Status = "idle" | "loading" | "error" | "success";

type Props = {
  onReport: (report: ValidationReport | null) => void;
};

export default function UploadForm({ onReport }: Props) {
  const [journalId, setJournalId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!journalId || !file) {
      setErrorMessage("Pick a journal and a PDF first.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMessage(null);
    onReport(null);

    const fd = new FormData();
    fd.append("pdf", file);
    fd.append("journal_id", journalId);

    try {
      const res = await fetch("/api/validate", { method: "POST", body: fd });
      const data = (await res.json()) as ValidationReport | ApiError;
      if (!res.ok || "error" in data) {
        const msg =
          "error" in data ? data.error : `validate returned ${res.status}`;
        throw new Error(msg);
      }
      onReport(data);
      setStatus("success");
    } catch (e) {
      setErrorMessage((e as Error).message);
      setStatus("error");
      onReport(null);
    }
  }

  const submitDisabled = status === "loading" || !journalId || !file;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label className="block mb-1.5 text-sm font-medium text-gray-800">
          Target journal
        </label>
        <JournalSelect
          value={journalId}
          onChange={setJournalId}
          disabled={status === "loading"}
        />
      </div>

      <div>
        <label className="block mb-1.5 text-sm font-medium text-gray-800">
          Manuscript PDF
        </label>
        <input
          type="file"
          accept="application/pdf"
          disabled={status === "loading"}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-emerald-700 disabled:cursor-not-allowed"
        />
        {file && (
          <p className="mt-1 text-xs text-gray-500">
            {file.name} · {(file.size / 1024).toFixed(0)} KB
          </p>
        )}
      </div>

      {status === "error" && errorMessage && (
        <div className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {errorMessage}
        </div>
      )}

      {status === "loading" && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          ⏳ Validating — the agent reads the guideline and reasons about your
          manuscript. Usually 20–40 seconds.
        </div>
      )}

      <button
        type="submit"
        disabled={submitDisabled}
        className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        {status === "loading" ? "Validating…" : "Validate"}
      </button>
    </form>
  );
}
