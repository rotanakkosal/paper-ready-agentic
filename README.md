# PaperReady

> An Agentic RAG system that validates academic manuscripts against journal-specific submission requirements before submission.

Researchers preparing a paper for journal submission must follow many journal-specific rules buried in long author-guideline PDFs — title page format, ORCID, reference style, figure captions, cover-letter format, conflict-of-interest statements, and more. Manual checking is slow, error-prone, and a common cause of desk rejection. PaperReady reads the target journal's author guidelines, the user's manuscript, and a structured database of journal rules, then produces a validation checklist, a missing-items report, a cover-letter draft, and reference compliance guidance.

![PaperReady UI — submit a manuscript, pick a journal, get a journal-specific compliance report](docs/screenshots/paper-ready-ui.png)

## Architecture

```
[Next.js frontend]   ── upload PDF + pick journal
        │
        ▼  POST /webhook/validate  (multipart: pdf + journal_id)
[n8n Validator Agent (Gemini 2.5 Flash)]
        │   one workflow:
        │     webhook → Extract from File (PDF) → Parse Manuscript (JS Code)
        │     ┊                                            │
        │     └─ HTTP → sidecar /journals/{id} ─ Merge ─┐
        │                                                ▼
        │                                       Qdrant search (top-5, journal-filtered)
        │                                                │
        │                                       Validator Agent + 4 tools
        │                                                │
        │                                          Clean Output → Respond
        │
        ├──► Qdrant   (235 author-guideline chunks across tpami + ivc, 3072-dim)
        ├──► Crossref REST   (DOI verification)
        ├──► DOAJ REST       (journal legitimacy + OA check)
        └──► Python sidecar  (CSV lookups: /journals, /reference-rules)
```

The entire agent pipeline (LLM reasoning, tool routing, retrieval coordination, response shaping) lives inside a single n8n workflow. PDF parsing happens inside the workflow via n8n's `Extract from File` node + a JavaScript `Code` node. The Python sidecar is a small FastAPI service exposing structured CSV lookups; Next.js is the UI shell.

## Tech stack

| Layer | Choice |
|---|---|
| Agent orchestration | n8n (self-hosted Docker, v2.20) |
| LLM (chat) | Gemini 2.5 Flash via Google AI Studio API |
| Embeddings | `gemini-embedding-001`, 3072 dims |
| Vector DB | Qdrant v1.11 (Docker) |
| External APIs | Crossref REST, DOAJ REST |
| Manuscript PDF parsing | n8n `Extract from File` + JS `Code` node |
| Guideline PDF ingest | Python (`pypdf` + `langchain-text-splitters`) |
| Structured CSV lookups | Python sidecar (FastAPI) |
| Frontend | Next.js 16 (App Router) + Tailwind 4 + React 19 |

## Repo layout

```
paper-ready/
├── docs/
│   ├── IMPLEMENTATION.md          # Build plan + status checklist
│   ├── design/                    # Per-component design docs
│   └── MIDTERM - Team11 ...pdf    # Original proposal deck
├── infra/
│   └── docker-compose.yml         # Qdrant container
├── ingest/
│   ├── data/                      # Source PDFs (gitignored — copyrighted)
│   ├── out/
│   │   ├── journal_metadata.csv   # 58 curated journals
│   │   └── reference_style_rules.csv  # 68 curated style rules
│   └── ingest_guideline.py        # PDF → chunks → Qdrant (throttled for free tier)
├── sidecar/                       # FastAPI service (CSV lookups only)
│   └── app/
│       ├── main.py                # GET /journals, /journals/{id}, /reference-rules/{style}
│       └── data.py                # CSV loaders + Vancouver style aliases
├── n8n/workflows/
│   ├── validate.workflow.ts       # n8n SDK source (TypeScript)
│   ├── validate.json              # Exported workflow (for import into n8n)
│   └── parse_manuscript.js        # Manuscript parser JS (embedded in workflow)
└── web/                           # Next.js 16 frontend
    ├── app/
    │   ├── page.tsx               # Upload form + report rendering
    │   └── api/
    │       ├── journals/route.ts  # Proxies sidecar /journals
    │       └── validate/route.ts  # Proxies n8n /webhook/validate
    └── components/
        ├── JournalSelect.tsx, UploadForm.tsx
        └── report/                # VerdictBanner, CategoryCard, EvidencePill
```

## Data

Two curated CSVs sit in [ingest/out/](ingest/out/). Both have been externally fact-checked.

### [journal_metadata.csv](ingest/out/journal_metadata.csv) — 58 journals

Scope: Computer Science / AI / CV / NLP / ML / Robotics / Data. Columns: `journal_id, name, publisher, scope_keywords, impact_factor_jcr2023, avg_review_time_weeks, apc_if_open_access_usd, open_access_status, required_reference_style, issn, homepage_url, reputation_flag`.

- `journal_id` is a curated kebab-case slug used as the public identifier (in URLs, dropdowns, Qdrant filters, agent tool arguments).
- `issn` is the rename-proof stable identifier.
- `reputation_flag` surfaces credibility concerns (e.g., `delisted_wos_2024` for MTAP).

### [reference_style_rules.csv](ingest/out/reference_style_rules.csv) — 68 rules

Covers APA 7, IEEE, Vancouver, Harvard, and Chicago. Columns: `rule_id, style_name, reference_type, element_type, rule_attribute, rule_value, example, notes`.

- `reference_type` distinguishes `journal_article`, `conference_paper`, `preprint`, `book`, `book_chapter` — important for AI/CV/NLP papers that cite arXiv and conferences heavily.

## Status

Built and verified end-to-end against a real CS manuscript (Vision Transformer paper, on both `tpami` and `ivc` journals — see `docs/IMPLEMENTATION.md` for the full task-level checklist).

- [x] Curated journal metadata (58 entries)
- [x] Curated reference-style rules (68 entries, with Vancouver-family aliases)
- [x] Qdrant container + guideline ingest pipeline (235 chunks across `tpami` + `ivc`)
- [x] Python sidecar — CSV lookups (`/journals`, `/journals/{id}`, `/reference-rules/{style}`)
- [x] n8n `validate` workflow — webhook → parse PDF → fetch journal → Qdrant search → AI agent → clean output
- [x] AI agent with four tools — `qdrant_search`, `get_reference_rules`, `crossref_verify_doi`, `doaj_lookup`
- [x] Next.js 16 frontend — journal dropdown, PDF upload, rendered `ValidationReport`
- [x] End-to-end test on TPAMI (IEEE style) and IVC (Elsevier-Vancouver) — distinct, journal-specific reports

**Deferred to a follow-up phase** (out of MVP scope):

- [ ] Cover-letter draft generation workflow
- [ ] DOCX manuscript support (PDF only for now)
- [ ] Template chunks in Qdrant (only author guidelines so far)
- [ ] Q&A gold-standard evaluation harness

## What a run looks like

User picks **TPAMI** in the dropdown, uploads a manuscript PDF, clicks **Validate**. Roughly 25 seconds later (during which the agent calls Qdrant 2–3 times, Crossref 1–2 times, the sidecar twice, and DOAJ once), the page renders:

- **Verdict banner**: `fail` (or `needs_revision` / `pass`) with pass/warn/fail counts
- **Five category cards**, each color-coded by status:
  - `reference_style` — comparisons against IEEE rules (cited by `rule_id`)
  - `doi_verification` — Crossref check on sampled DOIs
  - `title_page` — what the journal's guideline requires vs what the manuscript contains, cited by `{page, chunk_index_on_page}`
  - `declarations` — COI / funding / data availability / ethics statements
  - `legitimacy` — combines DOAJ result + the curated `reputation_flag`

Switching the journal to **IVC** and re-validating the same manuscript produces a **materially different report** — different reference-style rules, different declarations expected — proving the system adapts to journal-specific rules rather than running a one-size-fits-all check.

## Running locally

### Prerequisites

- **Docker Desktop** (for Qdrant + n8n)
- **Node.js 20.9+** (for the Next.js frontend)
- **uv** (Python package manager) — Python 3.11+
- A **Google AI Studio API key** — free tier is enough for development. Get one at <https://aistudio.google.com/apikey>.
- A running **n8n instance**. The repo doesn't bundle n8n's compose file (each developer's n8n setup is their own); the assumed setup is `localhost:5678`. The workflow JSON to import lives at `n8n/workflows/validate.json`.

### Setup

```powershell
# 1) Qdrant
docker compose -f infra/docker-compose.yml up -d

# 2) Gemini API key
cp ingest/.env.example ingest/.env
# Edit ingest/.env and set GOOGLE_API_KEY=AIza...

# 3) Place author-guideline PDFs into ingest/data/ (e.g. tpami_author_guide.pdf, ivc_author_guide.pdf)
#    Then ingest each one:
uv run --directory ingest python ingest_guideline.py --journal-id tpami --pdf data/tpami_author_guide.pdf
uv run --directory ingest python ingest_guideline.py --journal-id ivc   --pdf data/ivc_author_guide.pdf

# 4) Start the Python sidecar
uv run --directory sidecar uvicorn app.main:app --host 127.0.0.1 --port 8000

# 5) Start (or already-have-running) n8n at localhost:5678
#    - Import n8n/workflows/validate.json
#    - Create a "Google Gemini(PaLM) Api" credential using GOOGLE_API_KEY
#    - Attach it to the Gemini Embeddings + Gemini 2.5 Flash subnodes
#    - Activate / publish the workflow

# 6) Start the frontend
cd web
npm install
npm run dev
```

Then open <http://localhost:3000>, pick a journal, upload a PDF, click **Validate**.

### Free-tier rate limits

Validations call Gemini 2.5 Flash 7–10 times each (one initial reasoning round, one per tool call, one final synthesis). The **free tier caps at 20 chat-model requests per minute**, so back-to-back validations from the same key will be throttled. For demo use, space validations ~90 seconds apart, or move to a paid tier or a self-hosted LLM endpoint.

## License

Coursework — not for redistribution. Third-party PDFs in `ingest/data/` are copyrighted by their respective publishers and are not committed to this repository.
