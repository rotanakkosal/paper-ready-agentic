// Types mirror what the sidecar's /journals endpoint and the n8n validate
// webhook return. Loose — the n8n agent's ValidationReport is shaped by an
// LLM, so we don't enforce a strict schema here; we just have enough types
// to drive the UI without `any`.

export type Journal = {
  journal_id: string;
  name: string;
  publisher?: string;
  required_reference_style?: string;
  open_access_status?: string;
  reputation_flag?: string;
  // CSV passes through extras as strings — keep them addressable
  [key: string]: string | undefined;
};

export type JournalListResponse = {
  journals: Journal[];
  count: number;
};

export type CategoryStatus = "pass" | "fail" | "warn" | "pending" | string;

export type CategoryItem = {
  label: string;
  status: CategoryStatus;
  detail?: string;
};

export type EvidenceFromGuideline = {
  page: number;
  chunk_index_on_page: number;
  excerpt: string;
};

export type Category = {
  id: string;
  title: string;
  status: CategoryStatus;
  explanation: string;
  evidence_from_guideline?: EvidenceFromGuideline[];
  items?: CategoryItem[];
};

export type ValidationSummary = {
  verdict: "pass" | "needs_revision" | "fail" | string;
  pass_count: number;
  warn_count: number;
  fail_count: number;
};

/**
 * One row of the journal's submission requirements. The agent produces 8-15 of
 * these per report — atomic, must-have statements like "Title page lists all
 * author affiliations" or "References follow IEEE numbered style", each scored
 * pass/warn/fail/pending for this specific manuscript.
 *
 * This is the "Submission Checklist" block in the system architecture: a
 * journal-requirement view, not a per-finding view.
 */
export type SubmissionChecklistItem = {
  requirement: string;
  status: CategoryStatus;
  /** One-sentence reason this requirement passed / failed. */
  detail?: string;
  /** Page in the author guideline where this requirement is stated, if cited. */
  guideline_page?: number;
};

export type ValidationReport = {
  journal?: {
    journal_id: string;
    name: string;
    required_reference_style?: string;
  };
  summary?: ValidationSummary;
  categories?: Category[];
  /**
   * Flat list of journal submission requirements with this manuscript's
   * per-requirement status. The "Submission Checklist" final-phase output.
   * Older reports (pre-checklist-extension) may not include this; the UI
   * falls back to deriving an approximation from `categories[].items`.
   */
  submission_checklist?: SubmissionChecklistItem[];
  /**
   * Optional 150–250 word draft cover letter the agent produces alongside the
   * validation. Plain text with \n line breaks. Absent on older reports
   * generated before the cover-letter prompt extension.
   */
  cover_letter?: string;
};

export type ApiError = { error: string };
