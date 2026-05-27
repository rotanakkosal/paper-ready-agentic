"""
Extract a journal's full submission checklist from its author-guideline PDF.

Runs once per journal at ingest time. Reads the entire PDF in one Gemini call
and asks for an exhaustive, atomic, page-cited list of every submission
requirement. The output is a JSON file that the n8n agent loads at runtime
instead of trying to discover requirements on-the-fly via RAG.

Why this exists:
  RAG retrieves the top-k passages relevant to a query, so the agent only ever
  sees a small fraction of the guideline. Enumeration is the wrong job for
  RAG — you can't ask "what are all the requirements" because there's no
  single query that retrieves them all. This script does the enumeration
  once, at ingest time, with the whole guideline visible to the model.

Usage:
    uv run python extract_requirements.py --journal-id tpami --pdf data/tpami_author_guide.pdf
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import errors as genai_errors
from google.genai import types as genai_types
from pypdf import PdfReader


DEFAULT_MODEL = "gemini-2.5-flash"
DEFAULT_OUT_DIR = Path("out") / "requirements"
TARGET_ITEM_COUNT = "60 to 100, HARD CAP at 110"
JOURNAL_METADATA_CSV = Path("out") / "journal_metadata.csv"

# Backoff schedule for transient Google errors (503 UNAVAILABLE, 429 if it
# slips through, 500 INTERNAL). Tried in order. We don't loop forever — at
# some point a failure is real, not transient.
RETRY_DELAYS_SECONDS = [30, 60, 120, 240]

# Topics the agent already knows how to grade. Anything that doesn't fit goes
# under "other". Keep this list aligned with the agent's category schema so
# downstream grading can route items by topic.
KNOWN_TOPICS = [
    "title_page",
    "abstract_keywords",
    "highlights_graphical_abstract",
    "references",
    "figures_tables",
    "declarations",
    "data_availability",
    "ethics",
    "ai_disclosure",
    "manuscript_structure",
    "submission_process",
    "open_access_license",
    "other",
]

def build_system_instruction(journal_name: str, publisher: str) -> str:
    """Build the extraction prompt with the target journal baked in so the
    model can filter out rules that only apply to OTHER pubs in the same
    publisher bundle (e.g. an IEEE author guide that covers TPAMI alongside
    magazines and other Transactions)."""
    return f"""You are reading an author-guideline PDF.

The target journal is: **{journal_name}** (publisher: {publisher}).

Your job: enumerate EVERY submission requirement, mandatory step, and format rule that applies to THIS journal specifically. The output will be a compliance checklist the author must satisfy before submitting to {journal_name}.

Rules:
  - Target {TARGET_ITEM_COUNT} items. Do NOT exceed the cap. Quality and consolidation matter more than count.
  - One CHECKABLE requirement per item. Atomic but consolidated — if multiple sub-rules describe variations of the same compliance check (e.g. "font size for body text 10pt", "font size for captions 9pt", "font size for footnotes 8pt"), MERGE them into one item like "Use the journal's prescribed font sizes for body, captions, and footnotes (10pt / 9pt / 8pt)". A reviewer can confirm or reject all three by looking once.
  - Two rules belong together if a single human action satisfies both. Two rules belong apart if they need separate verification (e.g. "Provide ORCIDs" and "Provide author affiliations" are separate checks even though both live on the title page).
  - Each requirement is an imperative sentence ("Provide X", "Use Y format", "Include Z statement"). Not descriptive ("The journal accepts X").
  - Each item must cite the single most relevant page number where the rule appears.
  - Group items by topic. Use one of these topic slugs: {", ".join(KNOWN_TOPICS)}. Use "other" only if nothing else fits.
  - SKIP rules conditional on a publication type that {journal_name} is NOT. For example, if a rule starts with "For magazines, ..." and {journal_name} is a Transactions journal, skip it. If a rule names a different journal explicitly (e.g. "IEEE Computer Graphics and Applications"), skip it unless it matches {journal_name}.
  - SKIP vague requirements that don't produce a yes/no compliance check. "Adhere to limits" without stating the limit is useless; either include the specific limit if the guideline gives it nearby, or omit the rule.
  - SKIP duplicates and near-duplicates. If the guideline restates the same rule in two places, include it once.
  - Skip purely informational content. Only include rules that produce a yes/no compliance check.
  - Do NOT invent requirements not in the guideline. If the guideline is silent on something, omit it.

Output format: JSON matching the schema attached to this request."""


REQUIREMENTS_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "topic": {"type": "string", "enum": KNOWN_TOPICS},
                    "requirement": {"type": "string"},
                    "page": {"type": "integer"},
                },
                "required": ["topic", "requirement", "page"],
            },
        }
    },
    "required": ["items"],
}


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--journal-id", required=True, help="Slug from journal_metadata.csv (e.g. 'tpami')")
    p.add_argument("--pdf", required=True, help="Path to the author-guideline PDF")
    p.add_argument("--out", default=None, help=f"Output JSON path (default: {DEFAULT_OUT_DIR}/<journal_id>.json)")
    p.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        help=(
            f"Gemini model id (default: {DEFAULT_MODEL}). "
            "Try 'gemini-2.5-flash-lite' if Flash is returning 503 UNAVAILABLE for your region/account; "
            "Flash-Lite is fine for one-shot enumeration (the leak issue only affects multi-step agent loops)."
        ),
    )
    return p.parse_args()


def lookup_journal(script_dir: Path, journal_id: str) -> dict[str, str]:
    """Read journal_metadata.csv and return the row matching journal_id."""
    csv_path = script_dir / JOURNAL_METADATA_CSV
    if not csv_path.exists():
        return {}
    with csv_path.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row.get("journal_id") == journal_id:
                return row
    return {}


def load_pdf_with_page_markers(pdf_path: Path) -> str:
    """Return the whole guideline as one string with --- PAGE N --- markers so
    the model can cite pages reliably."""
    reader = PdfReader(str(pdf_path))
    parts: list[str] = []
    for i, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        if text:
            parts.append(f"--- PAGE {i} ---\n{text}")
    return "\n\n".join(parts)


def extract_requirements(
    gemini: genai.Client,
    model: str,
    guideline_text: str,
    journal_name: str,
    publisher: str,
) -> list[dict]:
    config = genai_types.GenerateContentConfig(
        system_instruction=build_system_instruction(journal_name, publisher),
        response_mime_type="application/json",
        response_schema=REQUIREMENTS_SCHEMA,
        temperature=0.2,
    )

    last_error: Exception | None = None
    for attempt, delay in enumerate([0, *RETRY_DELAYS_SECONDS]):
        if delay:
            print(f"      retry {attempt}/{len(RETRY_DELAYS_SECONDS)} in {delay}s ...")
            time.sleep(delay)
        try:
            response = gemini.models.generate_content(
                model=model,
                contents=f"Guideline:\n{guideline_text}",
                config=config,
            )
            parsed = json.loads(response.text)
            return parsed["items"]
        except (genai_errors.ServerError, genai_errors.APIError) as e:
            status = getattr(e, "code", None)
            if status in (503, 500, 429):
                last_error = e
                print(f"      transient {status} from Gemini, will retry")
                continue
            raise
    raise RuntimeError(
        f"Gemini extraction failed after {len(RETRY_DELAYS_SECONDS)} retries. Last error: {last_error}"
    )


def main() -> int:
    args = parse_args()
    script_dir = Path(__file__).resolve().parent
    load_dotenv(script_dir / ".env")

    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("ERROR: GOOGLE_API_KEY not set. Copy .env.example to .env and fill it in.", file=sys.stderr)
        return 1

    pdf_path = (script_dir / args.pdf).resolve() if not Path(args.pdf).is_absolute() else Path(args.pdf)
    if not pdf_path.exists():
        print(f"ERROR: PDF not found at {pdf_path}", file=sys.stderr)
        return 1

    out_path = Path(args.out) if args.out else (script_dir / DEFAULT_OUT_DIR / f"{args.journal_id}.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)

    journal = lookup_journal(script_dir, args.journal_id)
    journal_name = journal.get("name") or args.journal_id
    publisher = journal.get("publisher") or "unknown"
    if not journal:
        print(f"WARN: '{args.journal_id}' not found in journal_metadata.csv; falling back to slug as name.", file=sys.stderr)

    print(f"[1/3] Reading PDF: {pdf_path.name}")
    print(f"      target journal: {journal_name} ({publisher})")
    guideline_text = load_pdf_with_page_markers(pdf_path)
    approx_tokens = len(guideline_text) // 4
    print(f"      {len(guideline_text):,} chars, ~{approx_tokens:,} tokens")

    print(f"[2/3] Asking Gemini ({args.model}) to enumerate requirements")
    gemini = genai.Client(api_key=api_key)
    items = extract_requirements(gemini, args.model, guideline_text, journal_name, publisher)
    print(f"      got {len(items)} items")

    by_topic: dict[str, int] = {}
    for it in items:
        by_topic[it["topic"]] = by_topic.get(it["topic"], 0) + 1
    for topic, n in sorted(by_topic.items(), key=lambda x: -x[1]):
        print(f"        {topic:32s} {n}")

    output = {
        "journal_id": args.journal_id,
        "journal_name": journal_name,
        "publisher": publisher,
        "source_file": pdf_path.name,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model": args.model,
        "item_count": len(items),
        "items": items,
    }

    print(f"[3/3] Writing to {out_path}")
    out_path.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nDone. Review the items in {out_path.relative_to(script_dir.parent)}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
