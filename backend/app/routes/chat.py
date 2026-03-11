from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import require_hire, get_current_user
from app.models import QuestionLog
from app.schemas import AskRequest, AskResponse, ChatHistoryItem
from app.services.rag import answer_question
from typing import List

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/ask", response_model=AskResponse)
def ask_question(
    payload: AskRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_hire)
):
    """
    Core RAG endpoint. New hire submits a question →
    system retrieves relevant chunks → Claude generates answer.

    Full pipeline:
        1. Embed question (Voyage AI)
        2. Search Pinecone (cosine similarity, workspace-scoped)
        3. Generate answer (Claude with chunks as context)
        4. Log to questions_log table
        5. Return answer + source documents
    """
    workspace = current_user.workspace
    answer, was_answered, source_docs, chunk_ids = answer_question(
        question=payload.question,
        workspace_id=str(current_user.workspace_id),
        company_name=workspace.company_name
    )

    # Log every question regardless of whether it was answered
    log_entry = QuestionLog(
        hire_id=current_user.id,
        workspace_id=current_user.workspace_id,
        question=payload.question,
        answer=answer,
        source_chunks=chunk_ids,
        was_answered=was_answered,
    )
    db.add(log_entry)
    db.commit()

    return AskResponse(
        question=payload.question,
        answer=answer,
        was_answered=was_answered,
        source_documents=source_docs
    )


@router.get("/history", response_model=List[ChatHistoryItem])
def get_chat_history(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user=Depends(require_hire)
):
    """Return the last N questions asked by the authenticated new hire."""
    logs = (
        db.query(QuestionLog)
        .filter(QuestionLog.hire_id == current_user.id)
        .order_by(QuestionLog.asked_at.desc())
        .limit(limit)
        .all()
    )
    return logs