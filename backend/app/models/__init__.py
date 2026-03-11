"""
OnboardIQ — SQLAlchemy Models
All 5 tables: workspaces, users, documents, tasks, questions_log
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Integer, Boolean, Text, DateTime,
    ForeignKey, Enum as SAEnum, JSON
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


def now_utc():
    return datetime.now(timezone.utc)


# ── Workspace ─────────────────────────────────────────────────────────────────

class Workspace(Base):
    """
    One row per company. Root of all multi-tenant data.
    Every other table has a workspace_id FK pointing here.
    """
    __tablename__ = "workspaces"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_name   = Column(String(255), nullable=False)
    plan           = Column(SAEnum("free", "pro", name="plan_enum"), default="free", nullable=False)
    max_documents  = Column(Integer, default=10, nullable=False)
    created_at     = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    # Relationships
    users          = relationship("User", back_populates="workspace", cascade="all, delete-orphan")
    documents      = relationship("Document", back_populates="workspace", cascade="all, delete-orphan")
    tasks          = relationship("Task", back_populates="workspace", cascade="all, delete-orphan")
    questions_log  = relationship("QuestionLog", back_populates="workspace", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Workspace {self.company_name}>"


# ── User ──────────────────────────────────────────────────────────────────────

class User(Base):
    """
    HR admins and new hires. Role controls what they can see and do.
    RBAC enforced at route level via require_hr / require_hire dependencies.
    """
    __tablename__ = "users"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id    = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    email           = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=True)
    role            = Column(SAEnum("hr", "hire", name="role_enum"), nullable=False)
    name            = Column(String(255), nullable=False)
    department      = Column(String(100), nullable=True)
    start_date      = Column(DateTime(timezone=True), nullable=True)
    invited_at      = Column(DateTime(timezone=True), nullable=True)
    created_at      = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    # Relationships
    workspace       = relationship("Workspace", back_populates="users")
    documents       = relationship("Document", back_populates="uploaded_by_user")
    tasks           = relationship("Task", back_populates="hire", cascade="all, delete-orphan",
                                   foreign_keys="Task.hire_id")
    questions       = relationship("QuestionLog", back_populates="hire", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User {self.email} ({self.role})>"


# ── Document ──────────────────────────────────────────────────────────────────

class Document(Base):
    """
    Metadata about each uploaded file.
    Raw file → object storage (S3)
    Vectors  → Pinecone (namespaced by workspace_id)
    """
    __tablename__ = "documents"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id   = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    uploaded_by    = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    filename       = Column(String(255), nullable=False)
    file_url       = Column(Text, nullable=False)
    file_type      = Column(String(10), nullable=False)
    file_size_kb   = Column(Integer, nullable=True)
    status         = Column(
        SAEnum("processing", "ready", "failed", name="doc_status_enum"),
        default="processing",
        nullable=False
    )
    chunk_count    = Column(Integer, nullable=True)
    error_message  = Column(Text, nullable=True)
    uploaded_at    = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    # Relationships
    workspace        = relationship("Workspace", back_populates="documents")
    uploaded_by_user = relationship("User", back_populates="documents")

    def __repr__(self):
        return f"<Document {self.filename} ({self.status})>"


# ── Task ──────────────────────────────────────────────────────────────────────

class Task(Base):
    """
    Individual checklist items for a new hire.
    due_day is stored as integer (days after start_date).
    due_date is always computed at query time — never stored.
    """
    __tablename__ = "tasks"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hire_id      = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    title        = Column(Text, nullable=False)
    description  = Column(Text, nullable=True)
    category     = Column(
        SAEnum("30day", "60day", "90day", name="task_category_enum"),
        nullable=False
    )
    due_day      = Column(Integer, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at   = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    # Relationships
    hire      = relationship("User", back_populates="tasks", foreign_keys=[hire_id])
    workspace = relationship("Workspace", back_populates="tasks")

    @property
    def is_completed(self) -> bool:
        return self.completed_at is not None

    def __repr__(self):
        status = "✓" if self.is_completed else "○"
        return f"<Task {status} [{self.category}] {self.title[:40]}>"


# ── QuestionLog ───────────────────────────────────────────────────────────────

class QuestionLog(Base):
    """
    Every question asked by any new hire is logged here.
    Powers HR analytics dashboard and documentation gap detector.
    """
    __tablename__ = "questions_log"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hire_id       = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    workspace_id  = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    question      = Column(Text, nullable=False)
    answer        = Column(Text, nullable=False)
    source_chunks = Column(JSON, nullable=True)
    was_answered  = Column(Boolean, default=True, nullable=False)
    asked_at      = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    # Relationships
    hire      = relationship("User", back_populates="questions")
    workspace = relationship("Workspace", back_populates="questions_log")

    def __repr__(self):
        answered = "✓" if self.was_answered else "✗"
        return f"<QuestionLog {answered} {self.question[:50]}>"