"""
CobbyIQ — Remaining API Routes
documents, tasks, hires, analytics
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, timezone
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.core.security import require_hr, require_hire
from app.models import Document, Task, User, QuestionLog, Workspace
from app.schemas import (
    DocumentResponse, DocumentListResponse,
    TaskResponse, TaskListResponse, TaskCompleteResponse,
    HireCreate, HireResponse,
    AnalyticsOverview, GapReport, TopQuestion, HireProgress
)
from app.services.ingestion import run_ingestion
from app.services.rag import delete_document_vectors
from app.core.security import require_hr, hash_password

# ── Documents Router ──────────────────────────────────────────────────────────

documents_router = APIRouter(prefix="/documents", tags=["documents"])


@documents_router.post("/upload", response_model=DocumentResponse, status_code=201)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_hr)
):
    MAX_SIZE_KB = 10 * 1024

    ext = file.filename.split(".")[-1].lower()
    if ext not in ["pdf", "docx", "txt", "md"]:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

    file_bytes = await file.read()
    size_kb = len(file_bytes) // 1024
    if size_kb > MAX_SIZE_KB:
        raise HTTPException(status_code=400, detail="File exceeds 10MB limit")

    workspace = current_user.workspace
    doc_count = db.query(Document).filter(
        Document.workspace_id == workspace.id,
        Document.status != "failed"
    ).count()
    if doc_count >= workspace.max_documents:
        raise HTTPException(
            status_code=400,
            detail=f"Document limit reached ({workspace.max_documents}). Upgrade to Pro for more."
        )

    doc = Document(
        workspace_id=workspace.id,
        uploaded_by=current_user.id,
        filename=file.filename,
        file_url="pending",
        file_type=ext,
        file_size_kb=size_kb,
        status="processing"
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    background_tasks.add_task(
        run_ingestion,
        db=db,
        document_id=doc.id,
        workspace_id=workspace.id,
        filename=file.filename,
        file_bytes=file_bytes,
        file_type=ext
    )

    return doc


@documents_router.get("", response_model=DocumentListResponse)
def list_documents(
    db: Session = Depends(get_db),
    current_user=Depends(require_hr)
):
    docs = db.query(Document).filter(
        Document.workspace_id == current_user.workspace_id
    ).order_by(Document.uploaded_at.desc()).all()
    return DocumentListResponse(documents=docs, total=len(docs))


@documents_router.delete("/{document_id}", status_code=204)
def delete_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(require_hr)
):
    doc = db.query(Document).filter(
        Document.id == document_id,
        Document.workspace_id == current_user.workspace_id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    delete_document_vectors(
        workspace_id=str(current_user.workspace_id),
        document_id=str(document_id)
    )
    db.delete(doc)
    db.commit()


# ── Tasks Router ──────────────────────────────────────────────────────────────

tasks_router = APIRouter(prefix="/tasks", tags=["tasks"])


def _compute_task_response(task: Task, start_date: datetime) -> TaskResponse:
    due_date = start_date + timedelta(days=task.due_day) if start_date else None
    return TaskResponse(
        id=task.id,
        title=task.title,
        description=task.description,
        category=task.category,
        due_day=task.due_day,
        due_date=due_date,
        is_completed=task.is_completed,
        completed_at=task.completed_at,
    )


@tasks_router.get("", response_model=TaskListResponse)
def get_my_tasks(
    db: Session = Depends(get_db),
    current_user=Depends(require_hire)
):
    tasks = db.query(Task).filter(Task.hire_id == current_user.id).all()
    if not tasks:
        return TaskListResponse(day30=[], day60=[], day90=[], completion_score=0.0)

    completed = sum(1 for t in tasks if t.is_completed)
    completion_score = round((completed / len(tasks)) * 100, 1)
    start_date = current_user.start_date

    return TaskListResponse(
        day30=[_compute_task_response(t, start_date) for t in tasks if t.category == "30day"],
        day60=[_compute_task_response(t, start_date) for t in tasks if t.category == "60day"],
        day90=[_compute_task_response(t, start_date) for t in tasks if t.category == "90day"],
        completion_score=completion_score,
    )


@tasks_router.patch("/{task_id}/complete", response_model=TaskCompleteResponse)
def complete_task(
    task_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(require_hire)
):
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.hire_id == current_user.id
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.is_completed:
        raise HTTPException(status_code=400, detail="Task already completed")

    task.completed_at = datetime.now(timezone.utc)
    db.commit()
    return TaskCompleteResponse(id=task.id, completed_at=task.completed_at)


# ── Hires Router ──────────────────────────────────────────────────────────────

hires_router = APIRouter(prefix="/hires", tags=["hires"])

DEFAULT_TASKS = [
    {"title": "Complete account setup (email, Slack, tools)", "category": "30day", "due_day": 3},
    {"title": "Read the employee handbook", "category": "30day", "due_day": 5},
    {"title": "Meet your team members", "category": "30day", "due_day": 7},
    {"title": "Complete compliance training", "category": "30day", "due_day": 14},
    {"title": "30-day check-in with manager", "category": "30day", "due_day": 30},
    {"title": "Complete role-specific training modules", "category": "60day", "due_day": 45},
    {"title": "Shadow a senior team member on a project", "category": "60day", "due_day": 50},
    {"title": "60-day check-in with manager", "category": "60day", "due_day": 60},
    {"title": "Lead or contribute to your first project", "category": "90day", "due_day": 75},
    {"title": "Complete performance self-assessment", "category": "90day", "due_day": 85},
    {"title": "90-day review with manager", "category": "90day", "due_day": 90},
]


@hires_router.post("", response_model=HireResponse, status_code=201)
def create_hire(
    payload: HireCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_hr)
):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

    temp_password = payload.name.split()[0].lower() + "2025"

    hire = User(
        workspace_id=current_user.workspace_id,
        email=payload.email,
        name=payload.name,
        hashed_password=hash_password(temp_password),
        role="hire",
        department=payload.department,
        start_date=payload.start_date,
        invited_at=datetime.now(timezone.utc),
    )
    db.add(hire)
    db.flush()

    for task_data in DEFAULT_TASKS:
        task = Task(
            hire_id=hire.id,
            workspace_id=current_user.workspace_id,
            title=task_data["title"],
            category=task_data["category"],
            due_day=task_data["due_day"],
        )
        db.add(task)

    db.commit()
    db.refresh(hire)

    hire.temp_password = temp_password
    return hire

@hires_router.get("", response_model=List[HireResponse])
def list_hires(
    db: Session = Depends(get_db),
    current_user=Depends(require_hr)
):
    return db.query(User).filter(
        User.workspace_id == current_user.workspace_id,
        User.role == "hire"
    ).order_by(User.created_at.desc()).all()


# ── Analytics Router ──────────────────────────────────────────────────────────

analytics_router = APIRouter(prefix="/analytics", tags=["analytics"])


@analytics_router.get("/overview", response_model=AnalyticsOverview)
def get_overview(
    db: Session = Depends(get_db),
    current_user=Depends(require_hr)
):
    workspace_id = current_user.workspace_id

    hires = db.query(User).filter(
        User.workspace_id == workspace_id,
        User.role == "hire"
    ).all()

    hire_progress = []
    ttp_values = []

    for hire in hires:
        tasks = db.query(Task).filter(Task.hire_id == hire.id).all()
        if not tasks:
            continue

        total = len(tasks)
        completed = sum(1 for t in tasks if t.is_completed)
        score = round((completed / total) * 100, 1) if total else 0

        def phase_score(category):
            phase_tasks = [t for t in tasks if t.category == category]
            if not phase_tasks:
                return 0.0
            done = sum(1 for t in phase_tasks if t.is_completed)
            return round((done / len(phase_tasks)) * 100, 1)

        day30_tasks = [t for t in tasks if t.category == "30day"]
        if day30_tasks and all(t.is_completed for t in day30_tasks) and hire.start_date:
            last_completed = max(t.completed_at for t in day30_tasks)
            ttp = (last_completed - hire.start_date).days
            ttp_values.append(ttp)

        questions_count = db.query(QuestionLog).filter(
            QuestionLog.hire_id == hire.id
        ).count()

        hire_progress.append(HireProgress(
            hire_id=hire.id,
            hire_name=hire.name,
            department=hire.department,
            start_date=hire.start_date,
            completion_score=score,
            day30_score=phase_score("30day"),
            day60_score=phase_score("60day"),
            day90_score=phase_score("90day"),
            questions_asked=questions_count,
        ))

    total_q = db.query(QuestionLog).filter(QuestionLog.workspace_id == workspace_id).count()
    answered_q = db.query(QuestionLog).filter(
        QuestionLog.workspace_id == workspace_id,
        QuestionLog.was_answered == True
    ).count()
    answer_rate = round((answered_q / total_q) * 100, 1) if total_q else 100.0

    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    top_q = (
        db.query(QuestionLog.question, func.count(QuestionLog.id).label("freq"))
        .filter(
            QuestionLog.workspace_id == workspace_id,
            QuestionLog.asked_at >= thirty_days_ago
        )
        .group_by(QuestionLog.question)
        .order_by(func.count(QuestionLog.id).desc())
        .limit(10)
        .all()
    )

    avg_score = round(
        sum(h.completion_score for h in hire_progress) / len(hire_progress), 1
    ) if hire_progress else 0.0

    avg_ttp = round(sum(ttp_values) / len(ttp_values), 1) if ttp_values else None

    return AnalyticsOverview(
        total_hires=len(hires),
        avg_completion_score=avg_score,
        avg_time_to_productivity_days=avg_ttp,
        answer_rate=answer_rate,
        top_questions=[TopQuestion(question=q, frequency=f) for q, f in top_q],
        hires=hire_progress,
    )


@analytics_router.get("/gaps", response_model=GapReport)
def get_gap_report(
    db: Session = Depends(get_db),
    current_user=Depends(require_hr)
):
    workspace_id = current_user.workspace_id

    unanswered = (
        db.query(QuestionLog.question, func.count(QuestionLog.id).label("freq"))
        .filter(
            QuestionLog.workspace_id == workspace_id,
            QuestionLog.was_answered == False
        )
        .group_by(QuestionLog.question)
        .order_by(func.count(QuestionLog.id).desc())
        .limit(20)
        .all()
    )

    total_q = db.query(QuestionLog).filter(QuestionLog.workspace_id == workspace_id).count()
    total_unanswered = db.query(QuestionLog).filter(
        QuestionLog.workspace_id == workspace_id,
        QuestionLog.was_answered == False
    ).count()

    gap_score = round((total_unanswered / total_q) * 100, 1) if total_q else 0.0

    return GapReport(
        unanswered_questions=[TopQuestion(question=q, frequency=f) for q, f in unanswered],
        total_unanswered=total_unanswered,
        gap_score=gap_score,
    )
    
@analytics_router.get("/questions")
def recent_questions(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr),
):
    """Recent questions asked by hires in this workspace."""
    from app.models import QuestionLog, User as UserModel
    rows = (
        db.query(QuestionLog, UserModel.name)
        .join(UserModel, QuestionLog.hire_id == UserModel.id)
        .filter(QuestionLog.workspace_id == current_user.workspace_id)
        .order_by(QuestionLog.asked_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": str(q.id),
            "hire_name": name,
            "question": q.question,
            "was_answered": q.was_answered,
            "asked_at": q.asked_at.isoformat(),
        }
        for q, name in rows
    ]