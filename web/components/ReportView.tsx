"use client";

import VerdictBanner from "./report/VerdictBanner";
import CategoryCard from "./report/CategoryCard";
import CategoryToc from "./report/CategoryToc";
import CoverLetterCard from "./report/CoverLetterCard";
import SubmissionChecklist from "./report/SubmissionChecklist";
import { resolveChecklistItems, countByStatus } from "@/lib/checklist";
import type { ValidationReport, ValidationSummary } from "@/lib/types";

type Props = { report: ValidationReport };

/**
 * Layout: full-width verdict strip on top, then a two-pane grid (lg+) — sticky
 * SubmissionChecklist on the left, scrolling CategoryToc + per-category cards
 * + cover letter on the right. Collapses to a single stacked column below lg.
 *
 * Verdict counts are recomputed from the same items the SubmissionChecklist
 * renders (see lib/checklist) so the banner and the list can't disagree.
 */
export default function ReportView({ report }: Props) {
  const categories = report.categories ?? [];

  const checklistItems = resolveChecklistItems(report);
  let synthSummary: ValidationSummary | undefined = report.summary;
  if (report.summary && checklistItems.length > 0) {
    const c = countByStatus(checklistItems);
    synthSummary = {
      ...report.summary,
      pass_count: c.pass,
      warn_count: c.warn,
      fail_count: c.fail,
    };
  }

  return (
    <div className="space-y-4 lg:flex lg:flex-1 lg:flex-col lg:gap-6 lg:space-y-0 lg:min-h-0">
      {synthSummary && <VerdictBanner summary={synthSummary} />}

      <div className="grid gap-4 lg:grid-cols-5 lg:gap-6 lg:flex-1 lg:min-h-0">
        <aside className="lg:col-span-2 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
          <SubmissionChecklist report={report} />
        </aside>

        <div className="space-y-3 lg:col-span-3 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
          {categories.length > 0 && <CategoryToc categories={categories} />}
          {categories.map((c) => (
            <CategoryCard key={c.id} category={c} />
          ))}
          {report.cover_letter && (
            <CoverLetterCard coverLetter={report.cover_letter} />
          )}
        </div>
      </div>
    </div>
  );
}
