# PaperReady

> An Agentic RAG system that validates academic manuscripts against journal-specific submission requirements before submission.

Researchers preparing a paper for journal submission must follow many journal-specific rules buried in long author-guideline PDFs — title page format, ORCID, reference style, figure captions, cover-letter format, conflict-of-interest statements, and more. Manual checking is slow, error-prone, and a common cause of desk rejection. PaperReady reads the target journal's author guidelines, the user's manuscript, and a structured database of journal rules, then produces a validation checklist, a missing-items report, a cover-letter draft, and reference compliance guidance.

Midterm project for **Big Data Analysis (8862016-01)**, Spring 2026. Original proposal: [docs/MIDTERM - Team11 - PaperReady ...pdf](docs/MIDTERM%20-%20Team11%20-%20PaperReady%20-%20An%20Agentic%20RAG%20System%20for%20Pre-Submission%20Manuscript%20Validation%20-%2020260428.pdf).

## Architecture

```
[Next.js frontend]
        │
        ▼  HTTPS webhook (server-side, shared secret)
[n8n AI Agent (Gemini 2.5 Flash)]
        │
        ├──► Qdrant (guideline + template chunks, semantic search)
        ├──► Crossref API (DOI verification)
        ├──► DOAJ API (journal legitimacy + OA check)
        └──► Python sidecar (PDF parsing, structured CSV lookup, eval harness)
```

The entire agent pipeline (LLM reasoning, tool routing, retrieval coordination, response shaping) lives inside a single n8n workflow. The Python sidecar and Next.js frontend are not part of the agent — the sidecar is an input parser the agent calls as a tool, and Next.js is the UI shell.

## Tech stack

| Layer | Choice |
|---|---|
| Agent orchestration | n8n (self-hosted Docker) |
| LLM | Gemini 2.5 Flash via Google AI Studio API |
| Vector DB | Qdrant |
| External APIs | Crossref REST, DOAJ |
| Structured data | CSV via Python sidecar (pandas) |
| PDF parsing | Python sidecar (FastAPI + pypdf / unstructured) |
| Frontend | Next.js 15 (App Router) + Tailwind |
| Eval | Q&A gold-standard set scored by Python runner |

## Repo layout

```
paper-ready/
├── docs/                          # Original proposal deck
├── infra/                         # docker-compose snippet for Qdrant
├── ingest/
│   ├── data/                      # Source PDFs (gitignored — copyrighted)
│   └── out/                       # Curated structured data
│       ├── journal_metadata.csv
│       └── reference_style_rules.csv
├── n8n/workflows/                 # n8n workflow exports
└── web/                           # Next.js frontend
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

This repository is being built for a Thursday 2026-05-28 deadline. Current state:

- [x] Curated journal metadata (58 entries, externally reviewed)
- [x] Curated reference-style rules (68 entries, externally reviewed)
- [ ] Qdrant container + ingest pipeline for journal guideline PDFs
- [ ] Python sidecar (FastAPI) for manuscript parsing + structured-data lookup
- [ ] n8n workflows: `validate`, `cover-letter`
- [ ] Next.js frontend
- [ ] Q&A gold-standard evaluation harness

## Running locally

The runtime isn't built yet. Setup instructions will land here as each piece comes online.

## License

Coursework — not for redistribution. Third-party PDFs in `ingest/data/` are copyrighted by their respective publishers and are not committed to this repository.
