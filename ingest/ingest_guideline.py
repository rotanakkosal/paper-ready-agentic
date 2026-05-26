"""
Ingest a journal's author-guideline PDF into Qdrant.

Usage:
    uv run python ingest_guideline.py --journal-id ivc --pdf data/ivc_author_guide.pdf

The script parses the PDF page by page, chunks it with a recursive splitter that
preserves paragraph and sentence boundaries, generates embeddings via Gemini
(`gemini-embedding-001`, 768 dims), and upserts every chunk into the
`guideline_chunks` collection in Qdrant with the journal_id, page number, and
chunk index tagged in the payload so the agent can filter and cite them later.
"""

from __future__ import annotations

import argparse
import os
import sys
import time
import uuid
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types as genai_types
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pypdf import PdfReader
from qdrant_client import QdrantClient
from qdrant_client.http import models as qdrant_models


COLLECTION = "guideline_chunks"
EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIM = 768
CHUNK_SIZE = 600
CHUNK_OVERLAP = 80
# Gemini free tier caps at 100 embed requests/minute, and each item in a batch
# counts as a separate request. 25 per batch + 22s sleep ≈ 68 RPM, well under cap.
BATCH_SIZE = 25
BATCH_SLEEP_SECONDS = 22


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--journal-id", required=True, help="Slug from journal_metadata.csv (e.g. 'ivc')")
    p.add_argument("--pdf", required=True, help="Path to the author-guideline PDF (relative to this script's dir is OK)")
    p.add_argument("--wipe", action="store_true", help="Drop and recreate the collection before ingest (clears ALL journals)")
    return p.parse_args()


def load_pdf_pages(pdf_path: Path) -> list[tuple[int, str]]:
    """Return [(page_number_1indexed, page_text), ...]."""
    reader = PdfReader(str(pdf_path))
    pages: list[tuple[int, str]] = []
    for i, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        if text:
            pages.append((i, text))
    return pages


def chunk_pages(pages: list[tuple[int, str]]) -> list[dict]:
    """Split each page's text into chunks while tracking the source page."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    chunks: list[dict] = []
    for page_no, text in pages:
        for ci, chunk_text in enumerate(splitter.split_text(text)):
            chunks.append({"page": page_no, "chunk_index_on_page": ci, "text": chunk_text})
    return chunks


def embed_batch(client: genai.Client, texts: list[str]) -> list[list[float]]:
    """Embed a list of texts with Gemini, returning one vector per text."""
    result = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=texts,
        config=genai_types.EmbedContentConfig(
            task_type="RETRIEVAL_DOCUMENT",
            output_dimensionality=EMBEDDING_DIM,
        ),
    )
    return [list(e.values) for e in result.embeddings]


def ensure_collection(qdrant: QdrantClient, wipe: bool) -> None:
    exists = qdrant.collection_exists(COLLECTION)
    if exists and wipe:
        print(f"[wipe] Dropping existing collection '{COLLECTION}'")
        qdrant.delete_collection(COLLECTION)
        exists = False
    if not exists:
        print(f"[init] Creating collection '{COLLECTION}' (dim={EMBEDDING_DIM}, cosine)")
        qdrant.create_collection(
            collection_name=COLLECTION,
            vectors_config=qdrant_models.VectorParams(
                size=EMBEDDING_DIM,
                distance=qdrant_models.Distance.COSINE,
            ),
        )
        # Index journal_id so the agent can filter retrievals by journal cheaply.
        qdrant.create_payload_index(
            collection_name=COLLECTION,
            field_name="journal_id",
            field_schema=qdrant_models.PayloadSchemaType.KEYWORD,
        )


def delete_journal_chunks(qdrant: QdrantClient, journal_id: str) -> None:
    """Remove any prior chunks for this journal_id (idempotent re-runs)."""
    qdrant.delete(
        collection_name=COLLECTION,
        points_selector=qdrant_models.FilterSelector(
            filter=qdrant_models.Filter(
                must=[
                    qdrant_models.FieldCondition(
                        key="journal_id",
                        match=qdrant_models.MatchValue(value=journal_id),
                    )
                ]
            )
        ),
    )


def main() -> int:
    args = parse_args()
    script_dir = Path(__file__).resolve().parent
    load_dotenv(script_dir / ".env")

    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("ERROR: GOOGLE_API_KEY not set. Copy .env.example to .env and fill it in.", file=sys.stderr)
        return 1
    qdrant_url = os.getenv("QDRANT_URL", "http://localhost:6333")
    qdrant_api_key = os.getenv("QDRANT_API_KEY") or None

    pdf_path = (script_dir / args.pdf).resolve() if not Path(args.pdf).is_absolute() else Path(args.pdf)
    if not pdf_path.exists():
        print(f"ERROR: PDF not found at {pdf_path}", file=sys.stderr)
        return 1

    print(f"[1/5] Reading PDF: {pdf_path.name}")
    pages = load_pdf_pages(pdf_path)
    print(f"      {len(pages)} pages with extractable text")

    print(f"[2/5] Chunking (size={CHUNK_SIZE}, overlap={CHUNK_OVERLAP})")
    chunks = chunk_pages(pages)
    if not chunks:
        print("ERROR: PDF produced zero chunks. Is it a scanned image rather than text?", file=sys.stderr)
        return 1
    print(f"      {len(chunks)} chunks total")

    print(f"[3/5] Connecting clients (Gemini + Qdrant @ {qdrant_url})")
    gemini = genai.Client(api_key=api_key)
    qdrant = QdrantClient(url=qdrant_url, api_key=qdrant_api_key)
    ensure_collection(qdrant, wipe=args.wipe)
    if not args.wipe:
        # idempotent re-run: remove old chunks for THIS journal only
        delete_journal_chunks(qdrant, args.journal_id)
        print(f"      cleared any previous chunks for journal_id='{args.journal_id}'")

    print(f"[4/5] Embedding {len(chunks)} chunks in batches of {BATCH_SIZE} (sleep {BATCH_SLEEP_SECONDS}s between batches to stay under free-tier RPM cap)")
    t0 = time.time()
    embeddings: list[list[float]] = []
    total_batches = (len(chunks) + BATCH_SIZE - 1) // BATCH_SIZE
    for i in range(0, len(chunks), BATCH_SIZE):
        batch = chunks[i : i + BATCH_SIZE]
        embs = embed_batch(gemini, [c["text"] for c in batch])
        embeddings.extend(embs)
        batch_no = i // BATCH_SIZE + 1
        print(f"      batch {batch_no}/{total_batches} done ({len(embs)} embeddings)")
        if batch_no < total_batches:
            time.sleep(BATCH_SLEEP_SECONDS)
    print(f"      embedded in {time.time() - t0:.1f}s")

    print(f"[5/5] Upserting to Qdrant collection '{COLLECTION}'")
    points = [
        qdrant_models.PointStruct(
            id=str(uuid.uuid4()),
            vector=emb,
            payload={
                "journal_id": args.journal_id,
                "page": chunk["page"],
                "chunk_index_on_page": chunk["chunk_index_on_page"],
                "text": chunk["text"],
                "source_file": pdf_path.name,
            },
        )
        for chunk, emb in zip(chunks, embeddings)
    ]
    qdrant.upsert(collection_name=COLLECTION, points=points)

    info = qdrant.get_collection(COLLECTION)
    print(f"\nDone. Collection '{COLLECTION}' now has {info.points_count} points total.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
