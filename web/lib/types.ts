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

export type ValidationReport = {
  journal?: {
    journal_id: string;
    name: string;
    required_reference_style?: string;
  };
  summary?: ValidationSummary;
  categories?: Category[];
};

export type ApiError = { error: string };
