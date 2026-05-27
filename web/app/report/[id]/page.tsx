"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, FileText, AlertCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import ReportView from "@/components/ReportView";
import { getById, formatTimeAgo, type HistoryEntry } from "@/lib/history";
import { DEMO_REPORT } from "@/lib/demo-report";

const DEMO_ENTRY: HistoryEntry = {
  id: "demo",
  createdAt: new Date().toISOString(),
  fileName: "sample_manuscript.pdf",
  fileSize: 3743814,
  journalId: "tpami",
  journalName: DEMO_REPORT.journal?.name,
  verdict: DEMO_REPORT.summary?.verdict,
  report: DEMO_REPORT,
};

export default function ReportPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [entry, setEntry] = useState<HistoryEntry | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "not-found">(
    "loading",
  );

  useEffect(() => {
    if (!id) return;
    if (id === "demo") {
      setEntry(DEMO_ENTRY);
      setState("ready");
      return;
    }
    const found = getById(id);
    if (found) {
      setEntry(found);
      setState("ready");
    } else {
      setState("not-found");
    }
  }, [id]);

  return (
    <div className="flex min-h-full flex-col bg-muted/30 lg:h-screen lg:overflow-hidden">
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8 lg:flex lg:min-h-0 lg:flex-col lg:overflow-hidden">
        <div className="mb-6 lg:shrink-0">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to validator
          </Link>
        </div>

        {state === "loading" && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Loading report…
            </CardContent>
          </Card>
        )}

        {state === "not-found" && (
          <Card>
            <CardHeader className="flex flex-row items-start gap-3 space-y-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <div className="space-y-0.5">
                <CardTitle className="text-base">Report not found</CardTitle>
                <CardDescription className="text-xs">
                  This validation isn&apos;t in your browser history
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                History is stored locally in this browser. The report may have
                been cleared, may have been created in a different browser, or
                the link may be invalid.
              </p>
              <div className="mt-4">
                <Link
                  href="/"
                  className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                >
                  Back to validator
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {state === "ready" && entry && (
          <div className="space-y-5 lg:flex lg:flex-1 lg:flex-col lg:gap-5 lg:space-y-0 lg:min-h-0">
            <p className="truncate text-xs text-muted-foreground lg:shrink-0">
              {entry.fileName && (
                <>
                  <FileText className="-mt-0.5 mr-1 inline h-3 w-3" />
                  <span className="font-medium text-foreground">
                    {entry.fileName}
                  </span>
                  {entry.fileSize ? (
                    <> · {(entry.fileSize / 1024).toFixed(0)} KB</>
                  ) : null}
                  <span> · </span>
                </>
              )}
              <span>validated against </span>
              <span className="font-medium text-foreground">
                {entry.journalName ?? entry.journalId}
              </span>
              <span> · {formatTimeAgo(entry.createdAt)}</span>
            </p>

            <ReportView report={entry.report} />
          </div>
        )}
      </main>
    </div>
  );
}
