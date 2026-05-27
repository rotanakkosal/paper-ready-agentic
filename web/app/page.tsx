"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Library, FileUp, ListChecks } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import UploadForm, { type Status } from "@/components/UploadForm";
import ReportPanel from "@/components/ReportPanel";
import HistoryList from "@/components/HistoryList";
import { saveToHistory } from "@/lib/history";
import type { ValidationReport } from "@/lib/types";

const HOW_IT_WORKS = [
  {
    n: 1,
    Icon: Library,
    title: "Pick a journal",
    body: "58 CS / AI / NLP journals, author guidelines pre-indexed.",
  },
  {
    n: 2,
    Icon: FileUp,
    title: "Upload your manuscript",
    body: "PDF parsed for title, authors, references, declarations.",
  },
  {
    n: 3,
    Icon: ListChecks,
    title: "Read the report",
    body: "Compliance checklist with citations to guideline pages.",
  },
];

export default function Home() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Legacy: /?demo=1 now redirects to the dedicated demo report page so the
  // landing page can stay consistent (form + history) regardless of state.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") === "1") {
      router.replace("/report/demo");
    }
  }, [router]);

  const onStatusChange = useCallback(
    (next: Status, msg?: string | null) => {
      setStatus(next);
      setErrorMessage(msg ?? null);
    },
    [],
  );

  const onSuccess = useCallback(
    (report: ValidationReport, file: File, journalId: string) => {
      const entry = saveToHistory({
        fileName: file.name,
        fileSize: file.size,
        journalId,
        journalName: report.journal?.name,
        verdict: report.summary?.verdict,
        report,
      });
      router.push(`/report/${entry.id}`);
    },
    [router],
  );

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

        <div className="grid gap-6 md:grid-cols-2 md:items-start">
          <UploadForm
            onStatusChange={onStatusChange}
            onSuccess={onSuccess}
          />
          {status === "loading" || status === "error" ? (
            /* During validation or after an error, show the status panel.
               Once it succeeds we navigate away to /report/[id]. */
            <ReportPanel
              status={status}
              report={null}
              errorMessage={errorMessage}
            />
          ) : (
            /* Idle (or briefly after status=success while navigation happens) —
               show the history of past validations. */
            <HistoryList />
          )}
        </div>

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
      </main>
    </div>
  );
}
