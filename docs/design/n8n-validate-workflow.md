# Design — n8n Validate Workflow

The single n8n workflow that handles the validate flow. Cover-letter is a separate (stretch) workflow.

## Trigger

**Webhook node**, method `POST`, path `/validate`. Authentication: header `x-paperready-secret` must match `N8N_WEBHOOK_SECRET` env var (rejected at the workflow's first node otherwise).

Request shape (multipart):
- `pdf` — the manuscript PDF (binary field).
- `journal_id` — string, e.g. `tpami`.

Response shape: `application/json`, body matches `ValidationReport` (below).

## Node graph

```
[Webhook: POST /validate]    (multipart: pdf + journal_id)
        │
        ▼
[Function: validate secret + extract journal_id]
        │
        ├──────────────────────────────────────┐
        ▼                                      ▼
[Extract from File → PDF]                     [HTTP: GET sidecar /journals/{{journal_id}}]
        │                                      │
        ▼                                      │
[Code in JS: parse manuscript]                 │
   - regex out title, authors, ORCIDs          │
   - find Abstract / Keywords / References     │
   - extract DOIs (10.xxxx/...)                │
   - probe for declarations (COI, funding,     │
     data availability, ethics)                │
   - emit ParsedManuscript JSON                │
        │                                      │
        └────────────────┐             ┌───────┘
                         ▼             ▼
                  [Merge: {manuscript, journal}]
                              │
                              ▼
              [AI Agent (Gemini 2.5 Flash)]
                  - System prompt: validator persona
                  - Tools:
                    • qdrant_search(query)          [n8n Qdrant node, filter journal_id]
                    • get_reference_rules(style)    [HTTP sidecar]
                    • crossref_verify(doi)          [HTTP api.crossref.org]
                    • doaj_lookup(issn)             [HTTP doaj.org/api]
                  - Output: JSON matching ValidationReport
                              │
                              ▼
              [Function: validate JSON shape, set headers]
                              │
                              ▼
              [Respond to Webhook]
```

## Parsing the manuscript in n8n (replaces the sidecar's `/parse-manuscript`)

`Extract from File` gives you the raw text per page. The JS `Code` node then derives structure with the same heuristics that would have lived in a Python `parser.py`:

| Field | How |
|---|---|
| `title` | First long line (>20 chars) on page 1, above the abstract |
| `authors[].name`, `affiliation` | Lines between title and abstract |
| `authors[].orcid` | `/\d{4}-\d{4}-\d{4}-\d{3}[\dX]/g` |
| `abstract` | Text between `Abstract` and `Keywords` (case-insensitive) |
| `sections_detected[]` | Lines matching `/^(\d+\.?\s+)?[A-Z][A-Za-z ]{3,40}$/m` |
| `declarations.*` | Substring search for "conflict of interest", "funding", "data availability", "ethics" → `found`/`missing` |
| `references[].raw`, `.doi` | Split text after `References` heading on `[N]`/`N.`; extract DOIs with `/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/gi` |
| `stats` | `page_count`, `reference_count` |

Imperfect parsing is fine — the agent receives the structured fields and reasons over them with the retrieved guideline context. The parser's job is to surface structure, not to be authoritative.

The `ParsedManuscript` JSON shape that the Code node emits is the same one the original sidecar endpoint would have produced (see the table above for fields; the agent's prompt references them).

## AI Agent — system prompt (draft)

```
You are PaperReady, a pre-submission validator for academic manuscripts.

You will receive:
  - manuscript: structured fields parsed from the user's PDF
  - journal: target journal's metadata (id, name, required_reference_style, issn, ...)

Your job: produce a ValidationReport JSON with five categories:
  1. reference_style    — does the manuscript's reference list follow journal.required_reference_style?
  2. doi_verification   — for each DOI in manuscript.references[], does Crossref resolve it?
  3. title_page         — title, authors, affiliations, corresponding author, ORCIDs — what does the
                          journal's guideline (search via qdrant_search) require? What is present?
  4. declarations       — does the journal require COI / funding / data-availability / ethics
                          statements (qdrant_search), and are they present in manuscript.declarations?
  5. legitimacy         — call doaj_lookup with journal.issn; combine with journal.reputation_flag.

Rules:
  - Always cite guideline retrievals by {page, chunk_index_on_page}.
  - Never fabricate rule citations. If qdrant_search returns nothing for a topic, say "guideline
    silent on this" rather than guessing.
  - For DOI checks, call crossref_verify on AT MOST 5 randomly-sampled DOIs (rate-limit budget).
  - For reference style, first call get_reference_rules with journal.required_reference_style, then
    compare against the first 5 entries in manuscript.references. Don't try to check every reference.
  - Output ONLY the ValidationReport JSON. No prose before or after.
```

Token budget: 3 retrievals from Qdrant max, 1 get_reference_rules call, 5 crossref calls, 1 doaj call. Keep the loop bounded — agents that wander run up cost and break the demo.

## Tool definitions

### `qdrant_search`

n8n's native Qdrant node configured as a tool.

- **Collection:** `guideline_chunks`
- **Filter:** `{"must": [{"key": "journal_id", "match": {"value": "{{ $json.context.journal.journal_id }}" }}]}`
- **Top-K:** 5
- **Embed query:** Gemini `gemini-embedding-001` (must match ingest model)
- **Tool description for agent:** *"Search the target journal's author guideline. Returns 5 most relevant passages with page number and chunk index. Use for any question about format requirements."*

### `get_reference_rules`

HTTP Request tool.

- **URL:** `http://host.docker.internal:8000/reference-rules/{{ $fromAI('style_name') }}`
- **Method:** GET
- **Tool description:** *"Get all formatting rules for a reference style. Valid style_name values: 'APA 7', 'IEEE', 'Vancouver', 'Harvard', 'Chicago'."*

### `crossref_verify`

HTTP Request tool.

- **URL:** `https://api.crossref.org/works/{{ $fromAI('doi') }}`
- **Method:** GET
- **Headers:** `User-Agent: PaperReady/0.1 (mailto:youremail@example.com)` (Crossref polite pool)
- **Tool description:** *"Verify that a DOI resolves to a real Crossref record. Returns 200 with metadata if found, 404 if not."*
- Map response to `{"doi": "...", "resolves": true|false, "title": "..."}` in a small Function node post-call (or let the agent read the raw response).

### `doaj_lookup`

HTTP Request tool.

- **URL:** `https://doaj.org/api/search/journals/issn:{{ $fromAI('issn') }}`
- **Method:** GET
- **Tool description:** *"Look up a journal in DOAJ by ISSN. Returns matches if the journal is indexed (signal of OA legitimacy). Empty results don't mean illegitimate — many reputable journals aren't OA."*

## `ValidationReport` JSON shape

```json
{
  "journal": {
    "journal_id": "tpami",
    "name": "IEEE Transactions on Pattern Analysis and Machine Intelligence",
    "required_reference_style": "IEEE"
  },
  "summary": {
    "verdict": "needs_revision",
    "pass_count": 2,
    "warn_count": 2,
    "fail_count": 1
  },
  "categories": [
    {
      "id": "reference_style",
      "title": "Reference Style",
      "status": "fail",
      "explanation": "Manuscript uses APA-style author-year citations; journal requires IEEE numbered.",
      "evidence_from_guideline": [
        {"page": 4, "chunk_index_on_page": 2, "excerpt": "References should be numbered..."}
      ],
      "items": [
        {"label": "Citation format (numbered vs. author-year)", "status": "fail", "detail": "..."},
        {"label": "Reference list order (cited vs. alphabetical)", "status": "fail", "detail": "..."}
      ]
    },
    {
      "id": "doi_verification",
      "title": "DOI Resolution",
      "status": "warn",
      "explanation": "4 of 5 sampled DOIs resolved; 1 was not found in Crossref.",
      "items": [
        {"label": "10.1109/CVPR.2022.12345", "status": "pass"},
        {"label": "10.9999/fake.doi", "status": "fail", "detail": "Not in Crossref"}
      ]
    },
    ...
  ]
}
```

The frontend renders this. Schema stability matters — once it ships in [frontend.md](frontend.md), don't break field names without updating both sides.

## Error handling

- **Sidecar unreachable:** Respond 503 with `{"error": "manuscript parser unavailable"}`. Don't surface internal stack traces.
- **Qdrant unreachable:** Same — 503, surface a friendly message.
- **Agent returns non-JSON or schema-invalid output:** the post-agent Function node attempts one JSON salvage (regex out the first `{...}` block); if still invalid, return 502 `{"error": "agent output malformed"}` with the raw text in a `debug` field (gated behind a `?debug=1` query param so the demo doesn't leak it).

## Acceptance criteria

- [ ] `curl -X POST -F pdf=@sample.pdf -F journal_id=tpami -H "x-paperready-secret: $SECRET" http://localhost:5678/webhook/validate` returns a `ValidationReport` with all five category IDs present.
- [ ] At least one category has a non-empty `evidence_from_guideline` array.
- [ ] Swapping `journal_id=tpami` for `journal_id=ivc` returns a *different* report (different `required_reference_style`, different guideline excerpts).
- [ ] Total response time under 30s on a 10-page manuscript.
- [ ] Workflow export saved at `n8n/workflows/validate.json`.
