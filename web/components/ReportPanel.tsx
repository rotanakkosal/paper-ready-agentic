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
  Clock,
  Lightbulb,
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

const ERROR_TIPS = [
  "Hit the Gemini free-tier rate limit. Wait ~60 s before re-submitting.",
  "PDF under ~25 MB, not password-protected, text-based (not scanned).",
  "Target journal must be selected on the left.",
  "Crossref or Qdrant may be briefly slow. Retry once.",
];

function parseRateLimitSeconds(msg: string): number | null {
  if (!/rate.?limit|too many requests|429|free.?tier/i.test(msg)) return null;
  const m = msg.match(/(\d+)\s*(?:s\b|sec|second)/i);
  if (m) return Math.max(1, parseInt(m[1], 10));
  return 60;
}

type Props = {
  status: Status;
  report: ValidationReport | null;
  errorMessage?: string | null;
};

export default function ReportPanel({ status, report, errorMessage }: Props) {
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

  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  useEffect(() => {
    if (status !== "error" || !errorMessage) {
      setSecondsLeft(null);
      return;
    }
    setSecondsLeft(parseRateLimitSeconds(errorMessage));
  }, [status, errorMessage]);
  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0) return;
    const t = setTimeout(() => {
      setSecondsLeft((s) => (s === null ? null : Math.max(0, s - 1)));
    }, 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  if (status === "loading") {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
            <Sparkles className="h-5 w-5 text-foreground" />
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

  if (status === "error" && errorMessage) {
    const ready = secondsLeft !== null && secondsLeft <= 0;
    return (
      <Card>
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5">
            <AlertCircle className="h-5 w-5 text-destructive" />
          </div>
          <div className="space-y-0.5">
            <CardTitle className="text-base">Validation didn&apos;t complete</CardTitle>
            <CardDescription className="text-xs">
              The agent returned an error before producing a report
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed text-destructive">
            {errorMessage}
          </p>

          {secondsLeft !== null && (
            <div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 px-3.5 py-3">
              <Clock
                className={
                  "h-5 w-5 shrink-0 " +
                  (ready ? "text-emerald-600" : "text-muted-foreground")
                }
                aria-hidden
              />
              <div className="flex-1 min-w-0">
                <p
                  className={
                    "text-sm font-medium " +
                    (ready ? "text-emerald-700" : "text-foreground")
                  }
                >
                  {ready ? "Ready to retry" : `Try again in ${secondsLeft}s`}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {ready
                    ? "Re-submit the form on the left."
                    : "We'll let you know when the wait is over."}
                </p>
              </div>
              {!ready && (
                <span
                  className="font-mono text-base font-semibold tabular-nums text-foreground"
                  aria-live="polite"
                >
                  {secondsLeft}
                </span>
              )}
            </div>
          )}

          <div className="rounded-md border border-border bg-muted/30 px-3.5 py-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Lightbulb className="h-3.5 w-3.5" />
              Common causes
            </div>
            <ul className="space-y-1.5 text-xs leading-relaxed text-foreground/80">
              {ERROR_TIPS.map((tip, i) => (
                <li key={i} className="flex gap-2">
                  <span
                    className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60"
                    aria-hidden
                  />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-muted-foreground">
            The form on the left still has your selection. Just hit Validate
            again.
          </p>
        </CardContent>
      </Card>
    );
  }

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
