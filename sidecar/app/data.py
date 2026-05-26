"""CSV loaders for journal metadata and reference-style rules.

Both CSVs are read once and cached in memory at first access. They're small
(58 + 68 rows) and change only when curated manually, so process-lifetime
caching is fine.
"""

from __future__ import annotations

import csv
import os
from functools import lru_cache
from pathlib import Path
from typing import Optional


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


def get_journal(journal_id: str) -> Optional[dict[str, str]]:
    return next((j for j in load_journals() if j["journal_id"] == journal_id), None)


def get_rules_for_style(
    style_name: str, reference_type: Optional[str] = None
) -> list[dict[str, str]]:
    rules = [r for r in load_rules() if r["style_name"] == style_name]
    if reference_type:
        rules = [r for r in rules if r["reference_type"] == reference_type]
    return rules
