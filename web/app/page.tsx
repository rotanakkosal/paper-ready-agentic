"use client";

import { useState, useCallback, useEffect } from "react";
import { Library, FileUp, ListChecks } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import UploadForm, { type Status } from "@/components/UploadForm";
import ReportPanel from "@/components/ReportPanel";
import type { ValidationReport } from "@/lib/types";
import { DEMO_REPORT } from "@/lib/demo-report";

const HOW_IT_WORKS = [
  {
    n: 1,
    Icon: Library,
    title: "Pick a journal",
    body: "58 indexed CS / AI / Vision / NLP journals each with its author guidelines pre-parsed into a vector index.",
  },
  {
    n: 2,
    Icon: FileUp,
    title: "Upload your manuscript",
    body: "PDF parsed inside an n8n workflow: title, authors, ORCIDs, abstract, references, declarations.",
  },
  {
    n: 3,
    Icon: ListChecks,
    title: "Read the report",
    body: "An LLM agent compares your manuscript against the journal's rules and cites the page numbers it used.",
  },
];

export default function Home() {
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") === "1") {
      setReport(DEMO_REPORT);
      setStatus("success");
    }
  }, []);

  const onStatusChange = useCallback(
    (next: Status, msg?: string | null) => {
      setStatus(next);
      setErrorMessage(msg ?? null);
    },
    [],
  );

  const onReset = useCallback(() => {
    setReport(null);
    setStatus("idle");
    setErrorMessage(null);
  }, []);

  const compactForm = status === "success" && report !== null;

  return (
    <div className="flex min-h-full flex-col bg-muted/30">
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            PaperReady
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Catch desk-rejection issues before you submit. Pick the target
            journal, upload your manuscript, get a journal-specific compliance
            checklist with citations back to the official author guidelines.
          </p>
        </header>

        {compactForm ? (
          <div className="space-y-6">
            <UploadForm
              onReport={setReport}
              onStatusChange={onStatusChange}
              compact
              onReset={onReset}
              report={report}
            />
            <ReportPanel
              status={status}
              report={report}
              errorMessage={errorMessage}
            />
          </div>
        ) : (
          /* Idle / loading / error — two-column grid with form on the left. */
          <div className="grid gap-6 md:grid-cols-2 md:items-start">
            <UploadForm
              onReport={setReport}
              onStatusChange={onStatusChange}
              compact={false}
              onReset={onReset}
            />
            <ReportPanel
              status={status}
              report={report}
              errorMessage={errorMessage}
            />
          </div>
        )}

        {status === "idle" && (
          <section className="mt-10">
            <h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              How it works
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {HOW_IT_WORKS.map((step) => (
                <Card key={step.n}>
                  <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
                      <step.Icon className="h-4 w-4 text-foreground" />
                    </div>
                    <CardTitle className="text-sm leading-none">
                      {step.n}. {step.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-xs leading-relaxed">
                      {step.body}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </main>
      {/* <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-4 text-xs text-muted-foreground">
          <span>
            PaperReady · Midterm project, Big Data Analysis (8862016-01), Spring
            2026
          </span>
          <span className="text-muted-foreground/70">
            n8n · Gemini 2.5 Flash · Qdrant · Crossref · DOAJ
          </span>
        </div>
      </footer> */}
    </div>
  );
}
