"use client";

import { useState } from "react";
import UploadForm from "@/components/UploadForm";
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
        <section className="mt-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-xl font-semibold text-gray-900">
            ValidationReport (raw — T16 renders this nicely)
          </h2>
          <p className="mb-4 text-sm text-gray-600">
            {report.summary
              ? `Verdict: ${report.summary.verdict} · ${report.summary.pass_count} pass, ${report.summary.warn_count} warn, ${report.summary.fail_count} fail`
              : "Response received."}
          </p>
          <pre className="max-h-[60vh] overflow-auto rounded bg-gray-50 p-4 text-xs leading-5 text-gray-800">
            {JSON.stringify(report, null, 2)}
          </pre>
        </section>
      )}
    </main>
  );
}
