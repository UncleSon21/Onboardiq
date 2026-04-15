"""
CobbyIQ — RAG Service
Handles embedding, vector search, and LLM answer generation.

Flow:
  UPLOAD: document → chunks → embed (Voyage AI) → store (Pinecone)
  QUERY:  question → embed → search Pinecone → top chunks → Claude → answer
"""

import voyageai
from anthropic import Anthropic
from pinecone import Pinecone
from app.core.config import settings

# ── Clients ───────────────────────────────────────────────────────────────────

voyage_client = voyageai.Client(api_key=settings.VOYAGE_API_KEY)
anthropic_client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
pc = Pinecone(api_key=settings.PINECONE_API_KEY)
index = pc.Index(settings.PINECONE_INDEX_NAME)

# ── Constants ─────────────────────────────────────────────────────────────────

EMBEDDING_MODEL = "voyage-3"           # Voyage AI model
EMBEDDING_DIMENSIONS = 1024            # voyage-3 output dimensions
SIMILARITY_THRESHOLD = 0.5            # min score to consider a chunk relevant
TOP_K = 5                              # retrieve top 5 chunks per query
CLAUDE_MODEL = "claude-sonnet-4-6"     # Claude model for answer generation

SYSTEM_PROMPT = """You are CobbyIQ, an AI assistant helping new employees \
get answers during their onboarding at {company_name}.

You only answer questions using the company documentation provided below. \
If the answer is not in the documentation, say clearly: \
"I couldn't find this in your company's documents. Please ask your HR team."

Never make up information. Always be concise and friendly.

Company documentation:
{context}"""


# ── Embedding ─────────────────────────────────────────────────────────────────

def embed_text(text: str) -> list[float]:
    """
    Embed a single string using Voyage AI.
    Returns a list of floats (1024 dimensions for voyage-3).
    """
    result = voyage_client.embed(
        texts=[text],
        model=EMBEDDING_MODEL,
        input_type="document"         # use "query" for search queries
    )
    return result.embeddings[0]


def embed_query(query: str) -> list[float]:
    """
    Embed a search query using Voyage AI.
    Uses input_type="query" which is optimised for retrieval.
    """
    result = voyage_client.embed(
        texts=[query],
        model=EMBEDDING_MODEL,
        input_type="query"
    )
    return result.embeddings[0]


def embed_batch(texts: list[str]) -> list[list[float]]:
    """
    Embed multiple chunks in one API call (more efficient than one by one).
    Voyage AI supports batches of up to 128 texts.
    """
    result = voyage_client.embed(
        texts=texts,
        model=EMBEDDING_MODEL,
        input_type="document"
    )
    return result.embeddings


# ── Pinecone Vector Operations ────────────────────────────────────────────────

def upsert_chunks(
    workspace_id: str,
    document_id: str,
    filename: str,
    chunks: list[str],
    embeddings: list[list[float]]
):
    """
    Store embedded chunks in Pinecone.

    Namespace = workspace_id → ensures tenant isolation.
    Each vector is tagged with metadata for source attribution.
    """
    vectors = []
    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        vectors.append({
            "id": f"{document_id}_chunk_{i}",
            "values": embedding,
            "metadata": {
                "document_id": str(document_id),
                "filename": filename,
                "chunk_index": i,
                "text": chunk,                # stored for retrieval without re-fetching
                "workspace_id": str(workspace_id)
            }
        })

    # Upsert in batches of 100 (Pinecone limit per request)
    batch_size = 100
    for i in range(0, len(vectors), batch_size):
        index.upsert(
            vectors=vectors[i:i + batch_size],
            namespace=str(workspace_id)        # CRITICAL: tenant isolation
        )


def delete_document_vectors(workspace_id: str, document_id: str):
    """
    Delete all vectors for a document when it is deleted.
    Uses Pinecone metadata filter to find by document_id.
    """
    index.delete(
        filter={"document_id": {"$eq": str(document_id)}},
        namespace=str(workspace_id)
    )


def search_chunks(
    workspace_id: str,
    query_embedding: list[float],
    top_k: int = TOP_K
) -> list[dict]:
    """
    Search Pinecone for the most similar chunks to a query embedding.

    Cosine similarity formula (handled internally by Pinecone):
        similarity(A, B) = (A · B) / (||A|| × ||B||)

    Returns list of result dicts with score, text, and filename.
    Filters out results below SIMILARITY_THRESHOLD.
    """
    results = index.query(
        vector=query_embedding,
        top_k=top_k,
        namespace=str(workspace_id),
        include_metadata=True
    )

    # Filter by similarity threshold and extract metadata
    relevant = []
    for match in results.matches:
        if match.score >= SIMILARITY_THRESHOLD:
            relevant.append({
                "chunk_id": match.id,
                "score": match.score,
                "text": match.metadata.get("text", ""),
                "filename": match.metadata.get("filename", ""),
                "document_id": match.metadata.get("document_id", ""),
            })

    return relevant


# ── Answer Generation ─────────────────────────────────────────────────────────

def generate_answer(
    question: str,
    chunks: list[dict],
    company_name: str
) -> tuple[str, bool, list[str]]:
    """
    Generate an answer using Claude with retrieved chunks as context.

    Returns:
        answer (str)         — Claude's response
        was_answered (bool)  — False if no relevant chunks were found
        source_docs (list)   — filenames of documents used
    """
    if not chunks:
        return (
            "I couldn't find this in your company's documents. "
            "Please ask your HR team directly.",
            False,
            []
        )

    # Build context from retrieved chunks
    context_parts = []
    for i, chunk in enumerate(chunks, 1):
        context_parts.append(
            f"[Source: {chunk['filename']}]\n{chunk['text']}"
        )
    context = "\n\n---\n\n".join(context_parts)

    # Unique source document filenames
    source_docs = list({chunk["filename"] for chunk in chunks})

    # Call Claude
    response = anthropic_client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=1024,
        system=SYSTEM_PROMPT.format(
            company_name=company_name,
            context=context
        ),
        messages=[
            {"role": "user", "content": question}
        ]
    )

    answer = response.content[0].text
    return answer, True, source_docs


# ── Main RAG Pipeline ─────────────────────────────────────────────────────────

def answer_question(
    question: str,
    workspace_id: str,
    company_name: str
) -> tuple[str, bool, list[str], list[str]]:
    """
    Full RAG pipeline for a new hire question.

    Steps:
    1. Embed the question (query mode)
    2. Search Pinecone for relevant chunks
    3. Generate answer with Claude

    Returns:
        answer (str)
        was_answered (bool)
        source_docs (list[str])   — filenames used
        chunk_ids (list[str])     — Pinecone chunk IDs used (for logging)
    """
    # Step 1: Embed the query
    query_embedding = embed_query(question)

    # Step 2: Retrieve relevant chunks
    chunks = search_chunks(workspace_id, query_embedding)

    # Step 3: Generate answer
    answer, was_answered, source_docs = generate_answer(
        question, chunks, company_name
    )

    chunk_ids = [c["chunk_id"] for c in chunks]
    return answer, was_answered, source_docs, chunk_ids