<div align="center">

# CobbyIQ

### AI-powered enterprise onboarding copilot. Built for companies that can't afford to lose new hires in week one.

[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql&logoColor=white)](https://postgresql.org)
[![Pinecone](https://img.shields.io/badge/Pinecone-Vector_DB-00B8A9?style=flat-square)](https://pinecone.io)
[![Claude API](https://img.shields.io/badge/Claude-3.5_Sonnet-CC785C?style=flat-square)](https://anthropic.com)
[![LangChain](https://img.shields.io/badge/LangChain-0.2-1C3C3C?style=flat-square)](https://langchain.com)
[![Voyage AI](https://img.shields.io/badge/Voyage_AI-voyage--3-5B4CF5?style=flat-square)](https://voyageai.com)

**[Live Demo →](https://cobbyiq.com)** · **[API Docs →](https://cobbyiq.com/docs)**

</div>

---

## The Problem

The average enterprise new hire has **50+ documents** to read, **12 Slack channels** to join, and a manager too busy to answer the same question for the fifth time this month. The result: slower ramp, low confidence, and a churn rate that costs companies 6–9 months of salary per lost employee.

HR teams "solve" this with lengthy Notion wikis and a prayer.

---

## What CobbyIQ Does

CobbyIQ gives every new hire a private AI copilot that knows everything their company has written down — policies, org charts, tool guides, team norms — and can answer questions in plain English, cite exactly where it found the answer, and track what new hires don't understand so HR can fix the gaps.

For HR, it's a dashboard that shows which questions were asked, which went unanswered, and which onboarding documents are actually being used.

**It's not a chatbot wrapper. The hard part is knowing what the AI doesn't know, and refusing to guess.**

---

## Demo

> 📸 **Screenshot placeholder — add `/docs/screenshots/` here**
>
> Suggested shots:
> - New hire chat interface with a sourced answer
> - HR document upload + ingestion progress
> - Analytics dashboard (gap report)
> - 30/60/90-day task checklist

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Next.js Frontend                          │
│   New Hire Chat UI  ·  HR Admin Dashboard  ·  Task Tracker       │
└────────────────────────────┬─────────────────────────────────────┘
                             │  REST + JWT
┌────────────────────────────▼─────────────────────────────────────┐
│                     FastAPI Backend                               │
│                                                                   │
│   /auth  ──►  JWT + RBAC (hire vs. HR roles)                     │
│   /chat  ──►  RAG Service  ──►  Response + Citations             │
│   /docs  ──►  Ingestion Pipeline                                  │
│   /tasks ──►  PostgreSQL (30/60/90-day plan per hire)            │
│   /analytics ──► Aggregated gap analysis                         │
└────┬───────────────────────┬──────────────────────────────────────┘
     │                       │
     ▼                       ▼
┌─────────────┐     ┌─────────────────────────────────────────┐
│ PostgreSQL  │     │            RAG Pipeline                  │
│             │     │                                          │
│ companies   │     │  Document Upload                         │
│ hires       │     │    └─► Parse (PDF/DOCX/MD)              │
│ sessions    │     │    └─► Chunk (semantic, 512 tok,         │
│ tasks       │     │          50-tok overlap)                 │
│ documents   │     │    └─► Embed (Voyage AI voyage-3,        │
│ chat_logs   │     │          1024-dim)                        │
└─────────────┘     │    └─► Store (Pinecone, namespaced       │
                    │          by company_id)                   │
                    │                                          │
                    │  Query                                   │
                    │    └─► Embed question                    │
                    │    └─► Pinecone top-k retrieval          │
                    │    └─► Rerank by relevance score         │
                    │    └─► Prompt assembly + Claude call     │
                    │    └─► Source attribution + confidence   │
                    └─────────────────────────────────────────┘
```

---

## Why the Hard Parts Were Actually Hard

### 1. Conversation Flow: Knowing When the RAG Pipeline Should Stay Quiet

The naive approach — embed query → retrieve chunks → stuff into prompt → answer — fails immediately in practice. Users ask follow-up questions ("what about contractors?"), use pronouns ("does that apply to me?"), and expect the AI to hold context across a session.

The non-trivial piece is **deciding what belongs in each Claude prompt**. The pipeline:

1. **Reconstructs the grounded query** using recent turns — not the full history, which bloats context, but a sliding-window summary of what the user has actually established.
2. **Separates retrieval context from conversation context** in the prompt structure. Claude sees: *retrieved chunks* (what the company wrote) vs. *session context* (what this specific hire has already asked or confirmed). Mixing them causes hallucination.
3. **Routes unanswerable questions** — if Pinecone returns no chunks above the similarity threshold, the system doesn't fabricate. It responds with a structured "I don't have that information" and logs the question for the HR gap report. This required building a confidence layer on top of the raw retrieval score.

### 2. Multi-Tenant Isolation Without Blowing Up the Vector Index

Every company's documents had to be strictly isolated — hire at Company A cannot, under any circumstances, retrieve Company B's policy docs. Two approaches were evaluated:

- **Separate Pinecone indexes per tenant** — clean isolation, but doesn't scale economically and adds provisioning overhead.
- **Namespace-per-tenant inside one index** — chosen approach. Every embed/query operation is scoped to `company_{uuid}`. Pinecone namespaces provide hard query-time isolation with no cross-contamination risk.

PostgreSQL enforces the same isolation at the application layer via foreign key constraints and JWT claims carrying `company_id`.

### 3. Reducing Hallucination in Enterprise Docs

Enterprise policy documents are full of edge cases, exceptions, and "ask HR" disclaimers. Standard RAG will confidently answer with the closest chunk even when the closest chunk is tangential.

Three mitigations:

- **Strict source pinning**: Claude is instructed to answer *only* from the provided chunks and cite the source document and section. Any claim not traceable to a chunk triggers the fallback path.
- **Similarity threshold gating**: Queries that don't clear the cosine similarity floor skip the LLM entirely. No retrieval → no generation.
- **Chunk attribution in the response payload**: The API returns `answer`, `sources[]`, and `confidence_score` so the frontend can surface citations inline. Users can see *exactly* which paragraph the answer came from.

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | Next.js 14 (App Router) | Server components, fast auth flows |
| Backend | FastAPI | Async-native, auto-generates OpenAPI docs |
| Database | PostgreSQL 16 + SQLAlchemy + Alembic | Relational session + task state, clean migrations |
| Vector DB | Pinecone (serverless) | Production-grade ANN search, namespace isolation |
| Embeddings | Voyage AI `voyage-3` (1024-dim) | Outperforms `text-embedding-3-large` on retrieval benchmarks |
| LLM | Anthropic Claude 3.5 Sonnet | Best instruction-following for structured citation tasks |
| RAG orchestration | LangChain | Document loaders, text splitters, retrieval chain |
| Auth | JWT + RBAC | Two roles: `hire`, `hr_admin` |
| Infra | Docker Compose (local), Railway (prod) | |

---

## Project Structure

```
cobbyiq/
├── backend/
│   └── app/
│       ├── main.py              ← FastAPI app entrypoint
│       ├── core/
│       │   ├── config.py        ← Pydantic settings from .env
│       │   ├── database.py      ← SQLAlchemy async engine
│       │   └── security.py      ← JWT decode, RBAC dependency injection
│       ├── models/              ← SQLAlchemy ORM (6 tables)
│       ├── schemas/             ← Pydantic I/O contracts
│       ├── routes/
│       │   ├── auth.py          ← Register / login
│       │   ├── chat.py          ← /ask (RAG), /history
│       │   ├── documents.py     ← Upload → ingestion trigger
│       │   ├── tasks.py         ← 30/60/90-day plan CRUD
│       │   └── analytics.py     ← Usage + gap analysis
│       └── services/
│           ├── rag.py           ← Embed → retrieve → rerank → generate
│           └── ingestion.py     ← Parse → chunk → embed → upsert
├── frontend/
│   └── app/
│       ├── (hire)/chat/         ← New hire chat UI
│       ├── (hr)/dashboard/      ← HR admin views
│       └── (hr)/analytics/      ← Gap report
└── docker-compose.yml
```

---

## API Reference

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| `POST` | `/auth/register` | Public | Create company + HR admin account |
| `POST` | `/auth/login` | Public | Returns JWT |
| `POST` | `/documents/upload` | HR | Upload file → triggers async ingestion |
| `POST` | `/chat/ask` | Hire | RAG query → returns answer + sources |
| `GET` | `/chat/history` | Hire | Session message history |
| `GET` | `/tasks` | Hire | 30/60/90-day task list |
| `PATCH` | `/tasks/{id}/complete` | Hire | Mark task done |
| `POST` | `/hires` | HR | Create new hire + generate task plan |
| `GET` | `/analytics/overview` | HR | Usage metrics |
| `GET` | `/analytics/gaps` | HR | Unanswered / low-confidence questions |

Full interactive docs: `http://localhost:8000/docs` · Production: `https://cobbyiq.com/docs`

---

## Running Locally

```bash
# 1. Start PostgreSQL + pgAdmin
docker compose up -d

# 2. Backend
cd backend
python -m venv venv && source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env  # add ANTHROPIC_API_KEY, VOYAGE_API_KEY, PINECONE_API_KEY
alembic upgrade head
uvicorn app.main:app --reload
# → http://localhost:8000

# 3. Frontend
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

**Pinecone index config:**
- Index name: `cobbyiq`
- Dimensions: `1024` (voyage-3 output)
- Metric: `cosine`

---

## Built By

Solo project. FastAPI backend, Next.js frontend, full RAG pipeline, multi-tenant auth, and analytics — end to end.
