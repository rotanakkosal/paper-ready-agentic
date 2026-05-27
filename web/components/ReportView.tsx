"use client";

import VerdictBanner from "./report/VerdictBanner";
import CategoryCard from "./report/CategoryCard";
import CategoryToc from "./report/CategoryToc";
import CoverLetterCard from "./report/CoverLetterCard";
import SubmissionChecklist from "./report/SubmissionChecklist";
import type { ValidationReport } from "@/lib/types";

type Props = { report: ValidationReport };

/**
 * Renders the full validation report — verdict, submission checklist, sticky
 * TOC, category cards, and cover letter. Shared between the inline view on
 * `/` (legacy) and the dedicated `/report/[id]` page.
 */
export default function ReportView({ report }: Props) {
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
