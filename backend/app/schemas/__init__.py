"""
OnboardIQ — Pydantic Schemas
Request bodies and response shapes for all API routes.
"""

from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from datetime import datetime
from uuid import UUID


# ── Auth Schemas ──────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    workspace_id: UUID
    name: str
    email: str


class InviteRequest(BaseModel):
    email: EmailStr
    name: str
    role: str = "hire"
    department: Optional[str] = None
    start_date: Optional[datetime] = None


# ── Workspace Schemas ─────────────────────────────────────────────────────────

class WorkspaceCreate(BaseModel):
    company_name: str
    admin_email: EmailStr
    admin_name: str
    admin_password: str


class WorkspaceResponse(BaseModel):
    id: UUID
    company_name: str
    plan: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── User Schemas ──────────────────────────────────────────────────────────────

class UserResponse(BaseModel):
    id: UUID
    email: str
    name: str
    role: str
    department: Optional[str]
    start_date: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class HireCreate(BaseModel):
    email: EmailStr
    name: str
    department: Optional[str] = None
    start_date: Optional[datetime] = None


class HireResponse(UserResponse):
    completion_score: Optional[float] = None


# ── Document Schemas ──────────────────────────────────────────────────────────

class DocumentResponse(BaseModel):
    id: UUID
    filename: str
    file_type: str
    file_size_kb: Optional[int]
    status: str
    chunk_count: Optional[int]
    uploaded_at: datetime

    class Config:
        from_attributes = True


class DocumentListResponse(BaseModel):
    documents: List[DocumentResponse]
    total: int


# ── Chat Schemas ──────────────────────────────────────────────────────────────

class AskRequest(BaseModel):
    question: str

    @field_validator("question")
    @classmethod
    def question_not_empty(cls, v):
        if not v.strip():
            raise ValueError("Question cannot be empty")
        return v.strip()


class AskResponse(BaseModel):
    question: str
    answer: str
    was_answered: bool
    source_documents: List[str] = []


class ChatHistoryItem(BaseModel):
    id: UUID
    question: str
    answer: str
    was_answered: bool
    asked_at: datetime

    class Config:
        from_attributes = True


# ── Task Schemas ──────────────────────────────────────────────────────────────

class TaskResponse(BaseModel):
    id: UUID
    title: str
    description: Optional[str]
    category: str
    due_day: int
    due_date: Optional[datetime]
    is_completed: bool
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class TaskListResponse(BaseModel):
    day30: List[TaskResponse]
    day60: List[TaskResponse]
    day90: List[TaskResponse]
    completion_score: float


class TaskCompleteResponse(BaseModel):
    id: UUID
    completed_at: datetime
    message: str = "Task marked as complete"


# ── Analytics Schemas ─────────────────────────────────────────────────────────

class TopQuestion(BaseModel):
    question: str
    frequency: int


class HireProgress(BaseModel):
    hire_id: UUID
    hire_name: str
    department: Optional[str]
    start_date: Optional[datetime]
    completion_score: float
    day30_score: float
    day60_score: float
    day90_score: float
    questions_asked: int


class AnalyticsOverview(BaseModel):
    total_hires: int
    avg_completion_score: float
    avg_time_to_productivity_days: Optional[float]
    answer_rate: float
    top_questions: List[TopQuestion]
    hires: List[HireProgress]


class GapReport(BaseModel):
    unanswered_questions: List[TopQuestion]
    total_unanswered: int
    gap_score: float