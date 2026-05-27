"use client";

import { useState } from "react";
import UploadForm from "@/components/UploadForm";
import VerdictBanner from "@/components/report/VerdictBanner";
import CategoryCard from "@/components/report/CategoryCard";
import type { ValidationReport } from "@/lib/types";

export default function Home() {
  const [report, setReport] = useState<ValidationReport | null>(null);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900">PaperReady</h1>
        <p className="mt-2 text-sm text-gray-600">
          Check your manuscript against journal-specific submission rules
          before you submit. Pick the target journal, upload the PDF, get a
          checklist back.
        </p>
      </header>

      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <UploadForm onReport={setReport} />
      </section>

      {report && (
        <section className="mt-8 space-y-4">
          {report.summary && <VerdictBanner summary={report.summary} />}

          {report.journal && (
            <p className="text-sm text-gray-600">
              Validating against{" "}
              <strong className="text-gray-900">{report.journal.name}</strong>
              {report.journal.required_reference_style && (
                <>
                  {" · required reference style: "}
                  <strong className="text-gray-900">
                    {report.journal.required_reference_style}
                  </strong>
                </>
              )}
            </p>
          )}

          <div className="space-y-3">
            {(report.categories ?? []).map((c) => (
              <CategoryCard key={c.id} category={c} />
            ))}
          </div>

          {(!report.categories || report.categories.length === 0) && (
            <p className="text-sm text-gray-500">
              No categories returned. Raw response:
            </p>
          )}

          <details className="mt-6">
            <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
              Show raw JSON
            </summary>
            <pre className="mt-2 max-h-[40vh] overflow-auto rounded bg-gray-50 p-4 text-xs leading-5 text-gray-800">
              {JSON.stringify(report, null, 2)}
            </pre>
          </details>
        </section>
      )}
    </main>
  );
}
