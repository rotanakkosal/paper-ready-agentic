"""PaperReady sidecar — FastAPI service.

Structured CSV lookups for the n8n agent + the Next.js dropdown:
  GET  /healthz                          liveness
  GET  /journals                         list journals ingested into Qdrant
  GET  /journals?all=true                list all 58 journals from the CSV
  GET  /journals/{journal_id}            metadata for one journal
  GET  /reference-rules/{style_name}     formatting rules for a reference style
  GET  /requirements/{journal_id}        pre-extracted submission checklist for a journal

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
def list_journals(all: bool = Query(default=False)) -> dict:
    """List journals.

    By default, returns only journals that currently have author-guideline
    chunks indexed in Qdrant. This is what the frontend dropdown wants — a
    user can only meaningfully pick a journal the agent can actually
    retrieve guidelines for.

    Pass `?all=true` to get the full curated CSV (58 journals), e.g. for
    admin tooling or future workflows that don't depend on Qdrant.
    """
    journals = data.load_journals()
    if not all:
        indexed = data.indexed_journal_ids()
        journals = [j for j in journals if j["journal_id"] in indexed]
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


@app.get("/requirements/{journal_id}")
def get_requirements(journal_id: str) -> dict:
    """Return the pre-extracted submission requirements for a journal.

    The agent calls this once per validation and grades each item against
    the manuscript, instead of discovering requirements via RAG at run time.
    """
    reqs = data.load_requirements(journal_id)
    if reqs is None:
        raise HTTPException(
            status_code=404,
            detail={
                "error": f"no requirements file for journal '{journal_id}'. Run `extract_requirements.py` first.",
                "code": "requirements_not_found",
            },
        )
    return reqs
