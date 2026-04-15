"""
CobbyIQ — FastAPI Application Entry Point
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.routes.auth import router as auth_router
from app.routes.chat import router as chat_router
from app.routes import (
    documents_router, tasks_router, hires_router, analytics_router
)

app = FastAPI(
    title="CobbyIQ API",
    description="AI-powered employee onboarding copilot",
    version="0.1.0",
    docs_url="/docs",       # Swagger UI at http://localhost:8000/docs
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(documents_router)
app.include_router(tasks_router)
app.include_router(hires_router)
app.include_router(analytics_router)


@app.get("/health")
def health_check():
    return {"status": "ok", "env": settings.APP_ENV}