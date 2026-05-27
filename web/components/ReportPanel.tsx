"use client";

import { useState, useEffect } from "react";
import {
  FileSearch,
  AlertCircle,
  FileText,
  BookOpen,
  Search,
  BrainCircuit,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import VerdictBanner from "./report/VerdictBanner";
import CategoryCard from "./report/CategoryCard";
import CategoryToc from "./report/CategoryToc";
import CoverLetterCard from "./report/CoverLetterCard";
import SubmissionChecklist from "./report/SubmissionChecklist";
import type { ValidationReport } from "@/lib/types";
import type { Status } from "./UploadForm";

const LOADING_STEPS = [
  { icon: FileText, label: "Parsing manuscript PDF" },
  { icon: BookOpen, label: "Loading journal guideline from Qdrant" },
  { icon: Search, label: "Checking references against Crossref" },
  { icon: BrainCircuit, label: "Agent reasoning about compliance" },
  { icon: Sparkles, label: "Assembling validation report" },
];

type Props = {
  status: Status;
  report: ValidationReport | null;
  errorMessage?: string | null;
};

export default function ReportPanel({ status, report, errorMessage }: Props) {
  // Cycle the loading-step indicator while the agent runs. Resets every time
  // we leave the loading state.
  const [loadingStep, setLoadingStep] = useState(0);
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

  // LOADING — show the stepper inside the report shell
  if (status === "loading") {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-50">
            <Sparkles className="h-5 w-5 text-amber-600" />
          </div>
          <div className="space-y-0.5">
            <CardTitle className="text-base">Validating manuscript</CardTitle>
            <CardDescription className="text-xs">
              Typically 20–30 seconds
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2.5 rounded-lg border border-border bg-muted/30 p-4">
            {LOADING_STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = i < loadingStep;
              const active = i === loadingStep;
              return (
                <li
                  key={i}
                  className={
                    "flex items-center gap-2.5 text-sm " +
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
        </CardContent>
      </Card>
    );
  }

  // SUCCESS — render the actual report
  if (status === "success" && report) {
    const categories = report.categories ?? [];

    return (
      <div className="space-y-4">
        {report.summary && <VerdictBanner summary={report.summary} />}

        <SubmissionChecklist report={report} />

        {categories.length > 0 && (
          <div className="sticky top-0 z-20 -mx-2 border-b border-transparent bg-background/85 px-2 py-2.5 backdrop-blur-md">
            <CategoryToc categories={categories} />
          </div>
        )}

        <div className="space-y-3">
          {categories.map((c) => (
            <CategoryCard key={c.id} category={c} />
          ))}
        </div>

        {report.cover_letter && (
          <CoverLetterCard coverLetter={report.cover_letter} />
        )}
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

  // IDLE — empty preview shell
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
            Submit a manuscript to see your report
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
