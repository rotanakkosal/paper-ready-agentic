"""CSV loaders for journal metadata and reference-style rules.

Both CSVs are read once and cached in memory at first access. They're small
(58 + 68 rows) and change only when curated manually, so process-lifetime
caching is fine.
"""

from __future__ import annotations

import csv
import logging
import os
from functools import lru_cache
from pathlib import Path
from typing import Optional

from qdrant_client import QdrantClient

log = logging.getLogger(__name__)

QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
QDRANT_COLLECTION = "guideline_chunks"


def _data_dir() -> Path:
    """Resolve the CSV directory, honoring PAPERREADY_DATA_DIR if set."""
    override = os.getenv("PAPERREADY_DATA_DIR")
    if override:
        return Path(override).resolve()
    # Default: repo_root/ingest/out (this file lives at repo_root/sidecar/app/data.py)
    return (Path(__file__).resolve().parent.parent.parent / "ingest" / "out").resolve()


@lru_cache(maxsize=1)
def load_journals() -> list[dict[str, str]]:
    path = _data_dir() / "journal_metadata.csv"
    with path.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


@lru_cache(maxsize=1)
def load_rules() -> list[dict[str, str]]:
    path = _data_dir() / "reference_style_rules.csv"
    with path.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


# Aliases map publisher-flavoured style names from journal_metadata.csv to
# the base style names actually present in reference_style_rules.csv.
# Only conservative, well-justified mappings — publisher house variants of
# the same base style. Anything not listed will be looked up as-is (and
# return 404 if missing). This is intentional — the agent reasons about 404s.
STYLE_ALIASES: dict[str, str] = {
    "Elsevier-Vancouver": "Vancouver",
    "SAGE-Vancouver": "Vancouver",
    "APA": "APA 7",
}


def resolve_style_name(style_name: str) -> str:
    return STYLE_ALIASES.get(style_name, style_name)


def get_journal(journal_id: str) -> Optional[dict[str, str]]:
    return next((j for j in load_journals() if j["journal_id"] == journal_id), None)


def indexed_journal_ids() -> set[str]:
    """Return the set of journal_ids that currently have chunks in Qdrant.

    Scrolls the guideline_chunks collection and pulls the nested
    metadata.journal_id payload field. Not cached — the dropdown is called
    once per page load, and a fresh ingest should show up immediately.

    Returns an empty set if Qdrant is unreachable or the collection doesn't
    exist yet. Callers should treat an empty set as "show nothing" so the UI
    can render an appropriate empty state.
    """
    try:
        client = QdrantClient(url=QDRANT_URL, timeout=2.0)
        if not client.collection_exists(QDRANT_COLLECTION):
            return set()

        ids: set[str] = set()
        offset = None
        while True:
            points, offset = client.scroll(
                collection_name=QDRANT_COLLECTION,
                limit=256,
                with_payload=["metadata"],
                with_vectors=False,
                offset=offset,
            )
            for p in points:
                meta = (p.payload or {}).get("metadata") or {}
                jid = meta.get("journal_id")
                if jid:
                    ids.add(jid)
            if offset is None:
                break
        return ids
    except Exception as e:
        log.warning("indexed_journal_ids: Qdrant lookup failed: %s", e)
        return set()


def get_rules_for_style(
    style_name: str, reference_type: Optional[str] = None
) -> list[dict[str, str]]:
    resolved = resolve_style_name(style_name)
    rules = [r for r in load_rules() if r["style_name"] == resolved]
    if reference_type:
        rules = [r for r in rules if r["reference_type"] == reference_type]
    return rules
