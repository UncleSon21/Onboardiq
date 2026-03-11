"""
OnboardIQ — Document Ingestion Pipeline

Transforms uploaded files into searchable Pinecone vectors.

Steps:
  1. Parse (PDF / DOCX / TXT)
  2. Chunk (sliding window, 500 tokens, 50 overlap)
  3. Embed (Voyage AI batch)
  4. Store (Pinecone, namespaced by workspace_id)
  5. Update document status in PostgreSQL
"""

import io
import re
from uuid import UUID
from sqlalchemy.orm import Session
from pypdf import PdfReader
from docx import Document as DocxDocument

from app.models import Document
from app.services.rag import embed_batch, upsert_chunks

# ── Chunking Config ───────────────────────────────────────────────────────────

CHUNK_SIZE = 500      # approximate tokens per chunk (1 token ≈ 4 chars)
CHUNK_OVERLAP = 50    # overlap tokens between adjacent chunks
CHARS_PER_TOKEN = 4   # rough approximation

CHUNK_CHARS = CHUNK_SIZE * CHARS_PER_TOKEN      # = 2000 chars
OVERLAP_CHARS = CHUNK_OVERLAP * CHARS_PER_TOKEN  # = 200 chars


# ── Parsers ───────────────────────────────────────────────────────────────────

def parse_pdf(file_bytes: bytes) -> str:
    """Extract plain text from a PDF file."""
    reader = PdfReader(io.BytesIO(file_bytes))
    pages = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages.append(text.strip())
    return "\n\n".join(pages)


def parse_docx(file_bytes: bytes) -> str:
    """Extract plain text from a DOCX file."""
    doc = DocxDocument(io.BytesIO(file_bytes))
    paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
    return "\n\n".join(paragraphs)


def parse_txt(file_bytes: bytes) -> str:
    """Decode plain text file."""
    return file_bytes.decode("utf-8", errors="replace")


def parse_document(file_bytes: bytes, file_type: str) -> str:
    """
    Route to the correct parser based on file extension.
    Returns raw text string.
    """
    parsers = {
        "pdf":  parse_pdf,
        "docx": parse_docx,
        "txt":  parse_txt,
        "md":   parse_txt,
    }
    parser = parsers.get(file_type.lower())
    if not parser:
        raise ValueError(f"Unsupported file type: {file_type}")
    return parser(file_bytes)


# ── Chunker ───────────────────────────────────────────────────────────────────

def chunk_text(text: str) -> list[str]:
    """
    Sliding window chunker with overlap.

    Algorithm:
        chunk_size    = 500 tokens  (≈ 2000 chars)
        overlap       = 50 tokens   (≈ 200 chars)
        slide         = chunk_size - overlap = 450 tokens

    WHY OVERLAP:
        A sentence split across a boundary loses meaning.
        50-token overlap ensures boundary context is preserved
        in both adjacent chunks.

    Smart splitting: tries to break at sentence boundaries
    rather than mid-sentence.
    """
    # Clean whitespace
    text = re.sub(r'\n{3,}', '\n\n', text).strip()

    if len(text) <= CHUNK_CHARS:
        return [text] if text else []

    chunks = []
    start = 0

    while start < len(text):
        end = start + CHUNK_CHARS

        if end >= len(text):
            # Last chunk — take the rest
            chunk = text[start:].strip()
            if chunk:
                chunks.append(chunk)
            break

        # Try to break at a sentence boundary (. ! ?) within last 20% of chunk
        boundary_search_start = end - int(CHUNK_CHARS * 0.2)
        boundary = _find_sentence_boundary(text, boundary_search_start, end)
        end = boundary if boundary else end

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        # Slide forward by (chunk_size - overlap)
        start = end - OVERLAP_CHARS

    return chunks


def _find_sentence_boundary(text: str, search_from: int, search_to: int) -> int | None:
    """Find the last sentence-ending punctuation in a range."""
    for i in range(search_to, search_from, -1):
        if text[i] in ".!?\n":
            return i + 1
    return None


# ── Main Ingestion Pipeline ───────────────────────────────────────────────────

def run_ingestion(
    db: Session,
    document_id: UUID,
    workspace_id: UUID,
    filename: str,
    file_bytes: bytes,
    file_type: str
):
    """
    Full ingestion pipeline. Called after file is saved to storage.

    Steps:
        1. Parse → raw text
        2. Chunk → list of text chunks
        3. Embed → list of vectors (Voyage AI, batched)
        4. Store → Pinecone (namespaced by workspace_id)
        5. Update → document status in PostgreSQL

    This function is designed to run in a background task.
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        return

    try:
        # Step 1 — Parse
        raw_text = parse_document(file_bytes, file_type)
        if not raw_text.strip():
            raise ValueError("Document appears to be empty or unreadable")

        # Step 2 — Chunk
        chunks = chunk_text(raw_text)
        if not chunks:
            raise ValueError("No text chunks could be created from document")

        # Step 3 — Embed (batch API call is more efficient than one-by-one)
        embeddings = embed_batch(chunks)

        # Step 4 — Store in Pinecone
        upsert_chunks(
            workspace_id=str(workspace_id),
            document_id=str(document_id),
            filename=filename,
            chunks=chunks,
            embeddings=embeddings
        )

        # Step 5 — Update document status
        doc.status = "ready"
        doc.chunk_count = len(chunks)
        db.commit()

    except Exception as e:
        # Mark document as failed with error message
        doc.status = "failed"
        doc.error_message = str(e)
        db.commit()
        raise