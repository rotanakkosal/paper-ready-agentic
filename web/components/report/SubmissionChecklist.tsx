"use client";

import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  CircleDashed,
  ListChecks,
  BookOpen,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  ValidationReport,
  SubmissionChecklistItem,
} from "@/lib/types";

type IconStyle = {
  Icon: typeof CheckCircle2;
  color: string;
};

const STATUS_ICON: Record<string, IconStyle> = {
  pass: { Icon: CheckCircle2, color: "text-emerald-600" },
  fail: { Icon: XCircle, color: "text-rose-600" },
  warn: { Icon: AlertTriangle, color: "text-amber-600" },
  pending: { Icon: CircleDashed, color: "text-muted-foreground" },
};

const ORDER: Record<string, number> = {
  fail: 0,
  warn: 1,
  pending: 2,
  pass: 3,
};

/**
 * Fallback path: when the agent didn't produce a `submission_checklist` field
 * (older report shape), synthesise an approximation by treating each
 * categories[].items[] entry as a requirement. Not as good as the real thing,
 * but better than nothing for backward compatibility.
 */
function deriveChecklistFromCategories(
  report: ValidationReport,
): SubmissionChecklistItem[] {
  const rows: SubmissionChecklistItem[] = [];
  for (const c of report.categories ?? []) {
    for (const it of c.items ?? []) {
      rows.push({
        requirement: it.label,
        status: it.status,
        detail: it.detail,
      });
    }
  }
  return rows;
}

type Props = { report: ValidationReport };

export default function SubmissionChecklist({ report }: Props) {
  const fromAgent = report.submission_checklist ?? [];
  const items =
    fromAgent.length > 0 ? fromAgent : deriveChecklistFromCategories(report);
  if (items.length === 0) return null;

  const sorted = [...items].sort(
    (a, b) => (ORDER[a.status] ?? 99) - (ORDER[b.status] ?? 99),
  );

  const counts = sorted.reduce(
    (acc, r) => {
      if (r.status in acc) acc[r.status as keyof typeof acc] += 1;
      return acc;
    },
    { pass: 0, warn: 0, fail: 0, pending: 0 },
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
          <ListChecks className="h-5 w-5 text-foreground" />
        </div>
        <div className="space-y-0.5">
          <CardTitle className="text-base leading-none">
            Submission checklist
          </CardTitle>
          <CardDescription className="text-xs">
            {sorted.length} requirement{sorted.length === 1 ? "" : "s"} for{" "}
            <span className="font-medium text-foreground">
              {report.journal?.name ?? "the target journal"}
            </span>
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {sorted.map((row, i) => {
            const s = STATUS_ICON[row.status] ?? STATUS_ICON.pending;
            const { Icon } = s;
            const isAction = row.status === "fail" || row.status === "warn";
            return (
              <li
                key={`${row.requirement}-${i}`}
                className="flex items-start gap-2.5 px-1 py-2.5"
              >
                <Icon
                  className={`mt-0.5 h-4 w-4 shrink-0 ${s.color}`}
                  aria-hidden
                />
                <div className="flex-1 min-w-0">
                  <div
                    className={
                      "text-sm " +
                      (isAction
                        ? "font-medium text-foreground"
                        : "text-foreground/80")
                    }
                  >
                    {row.requirement}
                  </div>
                  {row.detail && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {row.detail}
                    </p>
                  )}
                  {row.guideline_page !== undefined && (
                    <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground/70">
                      <BookOpen className="h-3 w-3" />
                      Guideline · p.{row.guideline_page}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
