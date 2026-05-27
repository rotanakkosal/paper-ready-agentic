import type { ValidationReport, SubmissionChecklistItem } from "./types";

/**
 * Resolve the list of submission requirements + statuses for a report. Prefers
 * the agent-produced `submission_checklist[]` field; falls back to deriving
 * one from `categories[].items[]` for older reports that pre-date the
 * checklist extension. Single source of truth for both VerdictBanner counts
 * and the SubmissionChecklist component, so they can't disagree.
 */
export function resolveChecklistItems(
  report: ValidationReport,
): SubmissionChecklistItem[] {
  const fromAgent = report.submission_checklist ?? [];
  if (fromAgent.length > 0) return fromAgent;

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

export function countByStatus(items: SubmissionChecklistItem[]) {
  let pass = 0;
  let warn = 0;
  let fail = 0;
  let pending = 0;
  for (const it of items) {
    if (it.status === "pass") pass++;
    else if (it.status === "warn") warn++;
    else if (it.status === "fail") fail++;
    else if (it.status === "pending") pending++;
  }
  return { pass, warn, fail, pending };
}
