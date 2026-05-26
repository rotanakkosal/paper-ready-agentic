# PaperReady — Implementation Plan

**Deadline:** Thursday 2026-05-28
**Today:** Tuesday 2026-05-26
**Working window:** ~20 productive hours across Tue PM, Wed (full), Thu AM

This plan covers the **validate flow MVP only**. Cover-letter generation and the eval harness are stretch. See the per-component design docs under [design/](design/) for shapes and contracts.

## Goal

Ship a working end-to-end demo where a user can:

1. Open the Next.js app, pick a journal from the dropdown (58 journals from [journal_metadata.csv](../ingest/out/journal_metadata.csv)), upload a manuscript PDF.
2. The n8n agent retrieves the journal's guideline chunks from Qdrant, calls the Python sidecar to parse the manuscript, verifies DOIs against Crossref, checks the journal against DOAJ, and reasons over all of it.
3. The app renders a structured validation report: pass/fail checklist + a missing-items list with citations back to the guideline (page + chunk).

## MVP scope (what's IN)

- **Validate flow** end-to-end (`POST /webhook/validate`).
- **Two journals ingested into Qdrant**: `tpami` (IEEE, numbered citations) + `ivc` (Elsevier-Vancouver, numbered) — both CV journals, different publishers. Author guides are both clean single-scroll pages, easy to capture as PDF. Stretch: also ingest `ijcv` (Springer name-year) for stronger citation-style contrast.
- **Five validation categories**:
  1. Reference style compliance (against `required_reference_style` + `reference_style_rules.csv`).
  2. DOI verification (Crossref).
  3. Title-page elements (title, authors, affiliations, corresponding author, ORCID — retrieved from guideline).
  4. Required declarations (COI, funding, data availability — retrieved from guideline).
  5. Journal legitimacy flag (DOAJ + `reputation_flag` from CSV).
- **Next.js frontend**: single page with upload form + report rendering.
- **Python FastAPI sidecar**: PDF parsing + structured CSV lookup.

## Out of scope (stretch / cut if time)

- Cover-letter generation workflow.
- Figure/caption format checking (hard to extract reliably).
- Full eval harness (planned in [design/eval.md](design/eval.md); build only if validate ships early Thu morning).
- Auth, multi-user, persistence (everything is per-request, stateless).

## Architecture recap

```
Next.js (browser)
  └── POST /api/validate (server route, holds N8N_WEBHOOK_SECRET)
        └── POST n8n /webhook/validate (multipart: pdf + journal_id)
              ├── HTTP → sidecar /parse-manuscript  → manuscript JSON
              ├── HTTP → sidecar /journals/{id}     → journal metadata
              ├── AI Agent (Gemini 2.5 Flash) with tools:
              │     ├── qdrant_search(journal_id, query)
              │     ├── crossref_verify_doi(doi)
              │     ├── doaj_lookup(issn)
              │     └── get_reference_rules(style_name)
              └── returns ValidationReport JSON
```

## Task graph

Tasks are labelled `[T#]` with rough estimates. Dependencies are explicit so work can be parallelised in your head, even though it's a solo build.

| ID | Task | Est | Depends on | Status |
|---|---|---|---|---|
| T1 | Bring up Qdrant via `infra/docker-compose.yml` | 15m | — | ✅ |
| T2 | Download 2 author-guideline PDFs into `ingest/data/` (tpami, ivc) | 30m | — | ✅ |
| T3 | Run `ingest_guideline.py` for both PDFs; verify in dashboard | 45m | T1, T2 | ✅ (235 chunks) |
| T4 | Scaffold sidecar (FastAPI + uv, in `sidecar/`) | 30m | — | ✅ |
| T5 | Implement sidecar CSV endpoints (`/journals`, `/journals/{id}`, `/reference-rules/{style}`) | 1h | T4 | ✅ |
| T6 | Smoke-test sidecar with curl | 15m | T5 | ✅ |
| T7 | Create n8n validate workflow skeleton (webhook → response) | 30m | — | ✅ |
| T7b | Add `Extract from File` + JS `Code` parser node (replaces sidecar `/parse-manuscript`) | 1h | T7 | ✅ |
| T8 | Wire sidecar HTTP node (`/journals/{id}`) + Merge into workflow | 45m | T5, T7 | ✅ |
| T9 | Configure Qdrant search node with `journal_id` filter | 45m | T3, T7 |
| T10 | Add AI Agent node with tool definitions + system prompt | 2h | T8, T9 |
| T11 | Wire Crossref + DOAJ HTTP nodes as agent tools | 1h | T10 |
| T12 | Define `ValidationReport` JSON shape; format agent output | 1h | T10 |
| T13 | Scaffold Next.js app (App Router, Tailwind, shadcn optional) | 45m | — |
| T14 | Build upload page (journal dropdown + file input + submit) | 1.5h | T13 |
| T15 | Build Next.js `/api/validate` proxy route (handles secret) | 30m | T7, T13 |
| T16 | Render `ValidationReport` (checklist + missing items + citations) | 2h | T12, T14 |
| T17 | End-to-end test with 1 real manuscript on tpami | 1h | T11, T16 |
| T18 | End-to-end test with same manuscript on ivc (style mismatch) | 30m | T17 |
| T19 | Bug-bash + polish (loading states, error UI) | 1.5h | T17 |
| T20 | Submission docs: update README "Running locally", record demo | 1.5h | T19 |
| T21 | **Stretch:** eval harness with 10 Qs (see [design/eval.md](design/eval.md)) | 2h | T17 |
| T22 | **Stretch:** cover-letter workflow | 2h | T17 |

**Total MVP (T1–T20):** ~20h. Fits the window with no buffer — every cut decision below buys back time.

## Timeline

### Tuesday 2026-05-26 (afternoon, ~5h)
- T1, T2, T3 — Qdrant up, two journals ingested. **End-of-day checkpoint: Qdrant dashboard shows `guideline_chunks` with ~200+ points across two `journal_id` values.**
- T4, T5 (start) — sidecar scaffold + first two endpoints (`/journals`, `/journals/{id}`).

### Wednesday 2026-05-27 (~10h)
- AM: T5 (finish), T6, T7, T8, T9. **Lunch checkpoint: n8n workflow can call sidecar and Qdrant, returns raw retrieval JSON.**
- PM: T10, T11, T12. **End-of-day checkpoint: hitting the webhook with curl returns a `ValidationReport`.**

### Thursday 2026-05-28 (~5h before submission)
- AM: T13, T14, T15, T16. **Mid-morning checkpoint: app renders a real report end-to-end.**
- T17, T18, T19, T20. **Submit.**
- T21 / T22 only if T20 lands with time to spare.

## Acceptance criteria

Per-task ACs are inline in each design doc. Project-level criteria:

- [ ] Demo: pick `tpami`, upload a sample manuscript with bibliography in APA, get a report flagging "reference style mismatch — IEEE expected".
- [ ] Demo: pick `ivc`, upload same manuscript, get a different report (Elsevier-Vancouver expected, different declarations + OA policy surface).
- [ ] At least one item in the report cites a guideline chunk by page number.
- [ ] At least one DOI in the manuscript shows a Crossref verification result (✓ resolves / ✗ not found).
- [ ] Report renders cleanly in the browser, not just JSON.
- [ ] README "Running locally" section has copy-pasteable commands.

## Risks & cut order

If running late on Wed evening, cut in this order:

1. **First to cut:** T18 (second journal end-to-end). Demo with just `tpami`. *Saves 30m.*
2. **Next:** T11 DOAJ tool (keep Crossref). *Saves 30m.*
3. **Next:** T11 Crossref tool. Move DOI verification to "stretch — would require Crossref tool" in the report. *Saves 45m.*
4. **Next:** Drop validation categories 4 + 5 (declarations, legitimacy). Focus on style + DOIs + title-page. *Saves 1h.*
5. **Last resort:** Drop the agent's tool-calling loop. Make the workflow a linear pipeline that does Qdrant retrieval → single LLM call with all context stuffed in. Loses the "agentic" framing but ships. *Saves 1.5h of tool-tuning.*

Known unknowns to derisk early:
- **PDF parsing quality.** Some manuscripts are scanned or have weird columns. Test T6 with the actual sample you plan to demo before Wed lunch.
- **Gemini tool-calling reliability in n8n.** If the agent loops or misuses tools, fall back to cut #5 above rather than fighting prompts.

## Submission deliverables

- This repo, pushed to its default remote.
- A short demo video (Loom or screen recording) — 2-3 minutes, shows the two-journal contrast.
- README updates: "Running locally" section, status checklist all checked or honestly marked.
- Original proposal PDF stays in `docs/`.
