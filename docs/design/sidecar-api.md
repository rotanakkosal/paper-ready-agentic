# Design — Python Sidecar API

The sidecar is a small FastAPI service that handles **structured CSV lookups** for the n8n agent. It's deliberately narrow — the harder PDF-parsing work that the original design assigned here was moved into the n8n validate workflow itself (see [n8n-validate-workflow.md](n8n-validate-workflow.md)) so the parsing step shows up in the workflow editor and the demo story is "everything is in n8n".

## Why a sidecar (vs. inline n8n CSV nodes)

- **One HTTP call replaces multiple n8n Read-CSV-then-Merge node chains.** The agent calls `GET /reference-rules/{style}` and gets a clean list of typed rules; doing this in pure n8n would require reading the rules CSV, filtering, and merging on every agent invocation.
- **Powers the Next.js journal dropdown** via the same `/journals` endpoint — keeps that lookup off the agent's hot path.
- **Eval harness reuse** — if the eval is built (stretch), the same `data.py` loader is reusable from a Python runner.

## Project layout

```
sidecar/
├── pyproject.toml
├── .env.example
└── app/
    ├── __init__.py
    ├── main.py           # FastAPI app factory + routes
    └── data.py           # CSV loaders (cached in memory at startup)
```

## Endpoints

All endpoints return JSON. All errors return `{"error": "...", "code": "..."}` with the appropriate HTTP status.

### `GET /healthz`

Liveness probe. Returns `{"status": "ok"}`. n8n's "Wait until reachable" startup check hits this.

### `GET /journals`

List all journals from `journal_metadata.csv`. Returns:

```json
{
  "journals": [
    {
      "journal_id": "tpami",
      "name": "IEEE Transactions on Pattern Analysis and Machine Intelligence",
      "publisher": "IEEE",
      "required_reference_style": "IEEE",
      "open_access_status": "hybrid",
      "reputation_flag": null
    },
    ...
  ],
  "count": 58
}
```

Used by the Next.js frontend to populate the journal dropdown.

### `GET /journals/{journal_id}`

Full row for one journal. 404 if not found. Returns all CSV columns (impact_factor_jcr2023, avg_review_time_weeks, apc_if_open_access_usd, issn, homepage_url, scope_keywords, etc.). The n8n agent calls this once per validation run to load the target journal's metadata.

### `GET /reference-rules/{style_name}`

Style names are exactly the values in `reference_style_rules.csv` (`APA 7`, `IEEE`, `Vancouver`, `Harvard`, `Chicago`). The agent calls this after it knows the journal's required style.

Returns:

```json
{
  "style_name": "IEEE",
  "rules": [
    {
      "rule_id": "ieee-001",
      "reference_type": "journal_article",
      "element_type": "author",
      "rule_attribute": "format",
      "rule_value": "F. M. Last",
      "example": "J. A. Smith",
      "notes": "..."
    },
    ...
  ],
  "count": 14
}
```

Optional query param: `?reference_type=journal_article` to filter further (cuts payload roughly in half).

> **Note: manuscript parsing was moved to n8n.** Originally this doc specified a `POST /parse-manuscript` endpoint. We dropped it after deciding that doing PDF extraction + field parsing inside the n8n workflow (with `Extract from File` + a JS `Code` node) makes the demo story clearer and saves ~75 minutes of build time. The sidecar is now CSV-only.

## How n8n calls the sidecar

The sidecar runs on the host. n8n is in Docker. From n8n, base URL is `http://host.docker.internal:8000`.

In n8n HTTP Request nodes:
- `GET http://host.docker.internal:8000/journals/{{ $json.journal_id }}` — load journal metadata once per validation run.
- `GET http://host.docker.internal:8000/reference-rules/{{ $json.required_reference_style }}` — wired as an AI Agent tool.

The AI Agent's tool descriptions reference these (see [n8n-validate-workflow.md](n8n-validate-workflow.md)).

## Local dev

```powershell
cd sidecar
uv sync
copy .env.example .env
uv run uvicorn app.main:app --reload --port 8000
```

Browse `http://localhost:8000/docs` for the auto-generated OpenAPI UI — useful when wiring n8n nodes.

## Acceptance criteria

- [x] `GET /journals` returns 58 entries.
- [x] `GET /journals/tpami` returns IEEE as `required_reference_style`.
- [x] `GET /reference-rules/IEEE?reference_type=journal_article` returns at least 8 rules.
- [x] `GET /reference-rules/APA%207` works (URL-encoded space in style name).
- [x] 404 responses for unknown `journal_id` and unknown `style_name`.
- [x] Service stays warm (CSVs cached at startup via `@lru_cache`).
