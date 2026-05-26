"""PaperReady sidecar — FastAPI service.

Structured CSV lookups for the n8n agent + the Next.js dropdown:
  GET  /healthz                          liveness
  GET  /journals                         list all 58 journals (for frontend dropdown)
  GET  /journals/{journal_id}            metadata for one journal
  GET  /reference-rules/{style_name}     formatting rules for a reference style

Manuscript PDF parsing lives in the n8n validate workflow (Extract from File +
JS Code node), not here.
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException, Query

from . import data

app = FastAPI(title="PaperReady Sidecar", version="0.1.0")


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/journals")
def list_journals() -> dict:
    journals = data.load_journals()
    return {"journals": journals, "count": len(journals)}


@app.get("/journals/{journal_id}")
def get_journal(journal_id: str) -> dict:
    journal = data.get_journal(journal_id)
    if journal is None:
        raise HTTPException(
            status_code=404,
            detail={"error": f"journal '{journal_id}' not found", "code": "journal_not_found"},
        )
    return journal


@app.get("/reference-rules/{style_name}")
def get_reference_rules(
    style_name: str,
    reference_type: str | None = Query(default=None),
) -> dict:
    rules = data.get_rules_for_style(style_name, reference_type)
    if not rules:
        raise HTTPException(
            status_code=404,
            detail={"error": f"no rules for style '{style_name}'", "code": "style_not_found"},
        )
    return {
        "style_name": style_name,
        "reference_type": reference_type,
        "rules": rules,
        "count": len(rules),
    }
