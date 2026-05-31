"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
import { Upload, CloudUpload, CloudCheck, X } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import JournalSelect from "./JournalSelect";
import type { ValidationReport, ApiError } from "@/lib/types";

export type Status = "idle" | "loading" | "error" | "success";

type Props = {
  onStatusChange: (status: Status, errorMessage?: string | null) => void;
  /**
   * Called when validation finishes successfully. Receives the report plus
   * the file + journalId the user submitted, so the parent can save to
   * history and navigate to /report/[id].
   */
  onSuccess: (
    report: ValidationReport,
    file: File,
    journalId: string,
  ) => void;
};

export default function UploadForm({ onStatusChange, onSuccess }: Props) {
  const [journalId, setJournalId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onStatusChange(status, errorMessage);
  }, [status, errorMessage, onStatusChange]);

  function pickFile(f: File | null) {
    if (!f) return;
    const looksLikePdf =
      f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    if (looksLikePdf) {
      setFile(f);
    } else {
      setFile(null);
      setErrorMessage("Only PDF files are supported right now.");
      setStatus("error");
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!journalId || !file) {
      setErrorMessage("Pick a journal and a PDF first.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMessage(null);

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
      // Hand off to parent — parent saves to history and navigates to
      // /report/[id]. We don't flip to "success" status here because the
      // page will unmount during navigation anyway.
      onSuccess(data, file, journalId);
    } catch (err) {
      setErrorMessage((err as Error).message);
      setStatus("error");
    }
  }

  // -------- Full form view --------
  const submitDisabled = status === "loading" || !journalId || !file;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3 space-y-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
          <Upload className="h-5 w-5 text-foreground" />
        </div>
        <div className="space-y-0.5">
          <CardTitle className="text-base">Submit a manuscript</CardTitle>
          <CardDescription className="text-xs">
            Pick the target journal and upload your PDF
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Target journal
            </Label>
            <JournalSelect
              value={journalId}
              onChange={setJournalId}
              disabled={status === "loading"}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Manuscript PDF
            </Label>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              disabled={status === "loading"}
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />

            {!file ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  pickFile(e.dataTransfer.files?.[0] ?? null);
                }}
                disabled={status === "loading"}
                className={
                  "flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed px-6 py-8 text-center transition-colors disabled:cursor-not-allowed " +
                  (dragOver
                    ? "border-primary bg-accent"
                    : "border-border hover:border-foreground/30 hover:bg-accent/50")
                }
              >
                <CloudUpload className="h-9 w-9 text-muted-foreground" />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">
                    Choose a file or drag &amp; drop it here
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PDF only · up to ~25 MB
                  </p>
                </div>
                <span className="mt-1 inline-flex h-8 items-center justify-center rounded-lg border border-input bg-background px-4 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted/40">
                  Browse File
                </span>
              </button>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    pickFile(e.dataTransfer.files?.[0] ?? null);
                  }}
                  disabled={status === "loading"}
                  className={
                    "flex w-full flex-col items-center justify-center gap-2 rounded-2xl border px-6 py-8 text-center transition-colors disabled:cursor-not-allowed " +
                    (dragOver
                      ? "border-primary bg-accent"
                      : "border-primary/35 bg-gradient-to-b from-[#fdf6f8] to-white")
                  }
                >
                  <CloudCheck className="h-9 w-9 text-primary" />
                  <div className="w-full space-y-1">
                    <p className="break-all text-sm font-semibold text-foreground">
                      {file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(0)} KB ready to upload
                    </p>
                    <p className="pt-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
                      Drop new file or click to replace
                    </p>
                  </div>
                  <span className="mt-1 inline-flex h-8 items-center justify-center rounded-lg border border-input bg-background px-4 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted/40">
                    Browse File
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  disabled={status === "loading"}
                  aria-label="Remove file"
                  className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white hover:text-foreground hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          <Button
            type="submit"
            disabled={submitDisabled}
            className="w-full"
            size="lg"
          >
            {status === "loading" ? "Validating…" : "Validate manuscript"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
