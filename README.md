# PaperReady

> An Agentic RAG system that validates academic manuscripts against journal-specific submission requirements.

Researchers preparing a paper must follow many journal-specific rules buried in long author-guideline PDFs: title page format, ORCID, reference style, figure captions, cover-letter format, conflict-of-interest statements, and more. Manual checking is slow and a common cause of desk rejection. PaperReady reads the target journal's author guidelines, the user's manuscript, and a curated rules database, then returns a compliance checklist, a missing-items report, a cover-letter draft, and reference compliance guidance.

![PaperReady UI](docs/screenshots/paper-ready-ui.png)

## Running locally

### Prerequisites

- **Docker Desktop** for Qdrant and n8n
- **Node.js 20.9+** for the Next.js frontend
- **uv** (Python 3.11+) for the sidecar and ingest script
- A **Google AI Studio API key**. The free tier is enough for development: <https://aistudio.google.com/apikey>
- A running **n8n instance** at `localhost:5678`. Import `n8n/workflows/validate.json`.

### Setup

```powershell
# 1) Qdrant
docker compose -f infra/docker-compose.yml up -d

# 2) Gemini API key
cp ingest/.env.example ingest/.env
# Edit ingest/.env and set GOOGLE_API_KEY=AIza...

# 3) Place author-guideline PDFs into ingest/data/, then ingest each one
uv run --directory ingest python ingest_guideline.py --journal-id tpami --pdf data/tpami_author_guide.pdf
uv run --directory ingest python ingest_guideline.py --journal-id ivc   --pdf data/ivc_author_guide.pdf

# 4) Start the Python sidecar
uv run --directory sidecar uvicorn app.main:app --host 127.0.0.1 --port 8000

# 5) Start n8n at localhost:5678
#    Import n8n/workflows/validate.json, create a "Google Gemini(PaLM) Api"
#    credential using GOOGLE_API_KEY, attach it to the Gemini subnodes, and publish.

# 6) Start the frontend
cd web
npm install
npm run dev
```

Open <http://localhost:3000>, pick a journal, upload a PDF, click **Validate**.

### Free-tier rate limits

Each validation calls Gemini roughly 7 to 10 times (one initial round, one per tool call, one final synthesis). The free tier caps at 20 chat-model requests per minute, so back-to-back runs from the same key get throttled. For demo use, space validations about 90 seconds apart.

## Architecture

```
[Next.js frontend]   upload PDF + pick journal
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

The entire agent pipeline (LLM reasoning, tool routing, retrieval, response shaping) lives in a single n8n workflow. PDF parsing happens inside the workflow via n8n's `Extract from File` node plus a JavaScript `Code` node. The Python sidecar is a small FastAPI service that exposes CSV lookups. Next.js is the UI shell.

## Tech stack

| Layer | Choice |
|---|---|
| Agent orchestration | n8n (self-hosted Docker, v2.20) |
| LLM (chat) | Gemini 2.5 Flash via Google AI Studio |
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
│   ├── IMPLEMENTATION.md          # Build plan + task checklist
│   ├── design/                    # Per-component design docs
│   └── MIDTERM - Team11 ...pdf    # Original proposal deck
├── infra/
│   └── docker-compose.yml         # Qdrant container
├── ingest/
│   ├── data/                      # Source PDFs (gitignored, copyrighted)
│   ├── out/
│   │   ├── journal_metadata.csv   # 58 curated journals
│   │   └── reference_style_rules.csv  # 68 curated style rules
│   └── ingest_guideline.py        # PDF to chunks to Qdrant (throttled for free tier)
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

### [journal_metadata.csv](ingest/out/journal_metadata.csv), 58 journals

Scope: Computer Science, AI, CV, NLP, ML, Robotics, Data. Columns: `journal_id, name, publisher, scope_keywords, impact_factor_jcr2023, avg_review_time_weeks, apc_if_open_access_usd, open_access_status, required_reference_style, issn, homepage_url, reputation_flag`.

- `journal_id` is a curated kebab-case slug used as the public identifier (URLs, dropdowns, Qdrant filters, tool args).
- `issn` is the rename-proof stable identifier.
- `reputation_flag` surfaces credibility concerns (e.g., `delisted_wos_2024` for MTAP).

### [reference_style_rules.csv](ingest/out/reference_style_rules.csv), 68 rules

Covers APA 7, IEEE, Vancouver, Harvard, and Chicago. Columns: `rule_id, style_name, reference_type, element_type, rule_attribute, rule_value, example, notes`.

- `reference_type` distinguishes `journal_article`, `conference_paper`, `preprint`, `book`, `book_chapter`. This matters for AI/CV/NLP papers that cite arXiv and conferences heavily.
