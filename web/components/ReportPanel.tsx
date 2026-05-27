"use client";

import { FileSearch, AlertCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import VerdictBanner from "./report/VerdictBanner";
import CategoryCard from "./report/CategoryCard";
import CoverLetterCard from "./report/CoverLetterCard";
import type { ValidationReport } from "@/lib/types";
import type { Status } from "./UploadForm";

type Props = {
  status: Status;
  report: ValidationReport | null;
  errorMessage?: string | null;
};

export default function ReportPanel({ status, report, errorMessage }: Props) {
  // SUCCESS — render the actual report
  if (status === "success" && report) {
    return (
      <div className="space-y-4">
        {report.summary && <VerdictBanner summary={report.summary} />}

        {report.journal && (
          <p className="px-1 text-sm text-muted-foreground">
            Validating against{" "}
            <span className="font-medium text-foreground">
              {report.journal.name}
            </span>
            {report.journal.required_reference_style && (
              <>
                {" · required reference style: "}
                <span className="font-medium text-foreground">
                  {report.journal.required_reference_style}
                </span>
              </>
            )}
          </p>
        )}

        <div className="space-y-3">
          {(report.categories ?? []).map((c) => (
            <CategoryCard key={c.id} category={c} />
          ))}
        </div>

        {report.cover_letter && (
          <CoverLetterCard coverLetter={report.cover_letter} />
        )}

        <details className="px-1 pt-2">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            Show raw JSON
          </summary>
          <pre className="mt-2 max-h-[40vh] overflow-auto rounded-md bg-muted p-4 text-xs leading-5">
            {JSON.stringify(report, null, 2)}
          </pre>
        </details>
      </div>
    );
  }

  // ERROR — show the error inside the report shell
  if (status === "error" && errorMessage) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5">
            <AlertCircle className="h-5 w-5 text-destructive" />
          </div>
          <div className="space-y-0.5">
            <CardTitle className="text-base">Validation failed</CardTitle>
            <CardDescription className="text-xs">
              The agent didn&apos;t return a report
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground">{errorMessage}</p>
        </CardContent>
      </Card>
    );
  }

  // IDLE / LOADING — show the empty preview shell
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-start gap-3 space-y-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
          <FileSearch className="h-5 w-5 text-foreground" />
        </div>
        <div className="space-y-0.5">
          <CardTitle className="text-base">Validation report</CardTitle>
          <CardDescription className="text-xs">
            Compliance checklist with citations to the guideline
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex min-h-[280px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-accent/20 text-center">
          <FileSearch className="h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">
            Pick a journal and upload a PDF
          </p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            Your report will appear here · five categories: reference style,
            DOIs, title page, declarations, journal legitimacy
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
