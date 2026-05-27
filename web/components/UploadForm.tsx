"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
import {
  Upload,
  FileText,
  CloudUpload,
  X,
  BookOpen,
  Search,
  BrainCircuit,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
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
  onReport: (report: ValidationReport | null) => void;
  onStatusChange: (status: Status, errorMessage?: string | null) => void;
};

const LOADING_STEPS = [
  { icon: FileText, label: "Parsing manuscript PDF" },
  { icon: BookOpen, label: "Loading journal guideline from Qdrant" },
  { icon: Search, label: "Checking references against Crossref" },
  { icon: BrainCircuit, label: "Agent reasoning about compliance" },
  { icon: Sparkles, label: "Assembling validation report" },
];

export default function UploadForm({ onReport, onStatusChange }: Props) {
  const [journalId, setJournalId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onStatusChange(status, errorMessage);
  }, [status, errorMessage, onStatusChange]);

  // Cycle through honest-ish loading steps while the agent runs.
  // ~5s per step × 5 steps ≈ 25s matches typical agent latency.
  useEffect(() => {
    if (status !== "loading") {
      setLoadingStep(0);
      return;
    }
    const t = setInterval(() => {
      setLoadingStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1));
    }, 5000);
    return () => clearInterval(t);
  }, [status]);

  function pickFile(f: File | null) {
    if (f && f.type === "application/pdf") {
      setFile(f);
    } else if (f) {
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
    } catch (err) {
      setErrorMessage((err as Error).message);
      setStatus("error");
      onReport(null);
    }
  }

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
                  "flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors disabled:cursor-not-allowed " +
                  (dragOver
                    ? "border-foreground/50 bg-accent"
                    : "border-border hover:border-foreground/30 hover:bg-accent/50")
                }
              >
                <CloudUpload className="h-7 w-7 text-muted-foreground" />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">
                    Choose a file or drag &amp; drop it here
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PDF only · up to ~25 MB
                  </p>
                </div>
                <span className="mt-1 inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground shadow-sm">
                  Browse File
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
                <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(0)} KB
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setFile(null)}
                  disabled={status === "loading"}
                  aria-label="Remove file"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {status === "error" && errorMessage && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {status === "loading" && (
            <div className="rounded-lg border border-border bg-accent/40 p-3.5">
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Validating · typically 20–30 seconds
              </div>
              <ul className="space-y-1.5">
                {LOADING_STEPS.map((s, i) => {
                  const Icon = s.icon;
                  const done = i < loadingStep;
                  const active = i === loadingStep;
                  return (
                    <li
                      key={i}
                      className={
                        "flex items-center gap-2 text-sm " +
                        (done
                          ? "text-foreground"
                          : active
                            ? "font-medium text-foreground"
                            : "text-muted-foreground/60")
                      }
                    >
                      <span className="inline-flex h-5 w-5 items-center justify-center">
                        {done ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Icon className="h-4 w-4" />
                        )}
                      </span>
                      <span>{s.label}</span>
                      {active && (
                        <span className="ml-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-foreground" />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

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
