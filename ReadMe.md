# 📋 Project Tracker

> A full-stack project & task management platform with role-based access control — built with Next.js, FastAPI, and PostgreSQL, deployed on Railway.

<p align="center">
  <a href="https://enthusiastic-balance-production-a12b.up.railway.app"><strong>🌐 Live App</strong></a> &nbsp;·&nbsp;
  <a href="https://projecttracker-production-0b68.up.railway.app/docs"><strong>📖 API Docs (Swagger)</strong></a> &nbsp;·&nbsp;
  <a href="#-demo-video"><strong>🎬 Demo Video</strong></a>
</p>

---

## ✨ Features

| Feature | Details |
|---|---|
| **Authentication** | Signup & login with JWT — access + refresh tokens stored in httpOnly cookies |
| **Projects** | Create projects, write descriptions, manage the full lifecycle |
| **Team management** | Invite members by email, assign Admin or Member roles per project |
| **Task tracking** | Create tasks with title, description, priority (low/med/high), due date, and assignee |
| **Status tracking** | Three-state flow: `Todo → In Progress → Done` — click any task card to advance |
| **RBAC** | Admins control everything; Members only manage their own tasks |
| **Dashboard** | At-a-glance stats: projects, tasks, my tasks, overdue count + visual progress bar |
| **Overdue alerts** | Tasks past due date are flagged visually in red |
| **Kanban board** | Tasks organised in three columns per project, filterable by status |

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16 (App Router), TypeScript, Tailwind CSS, TanStack Query v5 |
| **Backend** | FastAPI, Python 3.11, SQLAlchemy 2.0 (async), Pydantic v2 |
| **Database** | PostgreSQL — Railway managed plugin |
| **Auth** | JWT via `python-jose`, password hashing via `passlib[bcrypt]` |
| **HTTP Client** | Axios with automatic token-refresh interceptor |
| **Deployment** | Railway — 3 separate services (frontend, backend, PostgreSQL) |

---

## 🚀 Live Deployment

| Service | URL |
|---|---|
| Frontend | https://enthusiastic-balance-production-a12b.up.railway.app |
| Backend API | https://projecttracker-production-0b68.up.railway.app |
| Swagger UI | https://projecttracker-production-0b68.up.railway.app/docs |
| Health check | https://projecttracker-production-0b68.up.railway.app/health |

All three services run inside a single Railway project, communicating over Railway's private network.

---

## 🎬 Demo Video

> (https://www.loom.com/share/a7d36c1331cb4bd1b972698db628495b)

---

## 📁 Repository Structure

```
project-tracker/             ← repo root
├── README.md
│
├── Backend/                 ← FastAPI service
│   ├── app/
│   │   ├── api/v1/endpoints/
│   │   │   ├── auth.py        # signup, login, refresh, logout, /me
│   │   │   ├── projects.py    # project CRUD + member management
│   │   │   ├── tasks.py       # task CRUD with RBAC enforcement
│   │   │   └── dashboard.py   # aggregated stats
│   │   ├── core/
│   │   │   ├── config.py      # pydantic-settings env config
│   │   │   ├── security.py    # JWT create/decode, bcrypt
│   │   │   └── deps.py        # FastAPI dependency injection (auth guards)
│   │   ├── db/session.py      # async SQLAlchemy engine + get_db
│   │   ├── models/models.py   # User, Project, ProjectMember, Task
│   │   ├── schemas/schemas.py # Pydantic request/response schemas
│   │   └── main.py            # app factory, CORS, lifespan
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
│
└── frontend-next/           ← Next.js service
    ├── app/
    │   ├── (auth)/
    │   │   ├── login/page.tsx
    │   │   └── signup/page.tsx
    │   └── (dashboard)/
    │       ├── layout.tsx          # sidebar + auth guard
    │       ├── dashboard/page.tsx  # stats dashboard
    │       └── projects/
    │           ├── page.tsx        # project list
    │           └── [id]/page.tsx   # kanban board + members
    ├── lib/
    │   ├── api.ts                  # axios client + all API calls
    │   └── auth-context.tsx        # React auth context + provider
    └── types/index.ts              # TypeScript interfaces
    ├── Dockerfile
    └── package.json
```

---

## 🗄️ Database Schema

```
┌─────────────────────────────────────────┐
│                  users                  │
│  id (UUID PK)  email (unique)           │
│  full_name     hashed_password          │
│  is_active     created_at               │
└──────────────┬──────────────────────────┘
               │ 1:∞
┌──────────────▼──────────────────────────┐
│            project_members              │
│  id (UUID PK)   project_id (FK)         │
│  user_id (FK)   role (admin|member)     │
│  joined_at                              │
└──────────────┬──────────────────────────┘
               │ ∞:1
┌──────────────▼──────────────────────────┐
│               projects                  │
│  id (UUID PK)   name    description     │
│  is_active      created_at  updated_at  │
└──────────────┬──────────────────────────┘
               │ 1:∞
┌──────────────▼──────────────────────────┐
│                 tasks                   │
│  id (UUID PK)   title   description     │
│  status  (todo | in_progress | done)    │
│  priority (low | medium | high)         │
│  due_date        project_id (FK)        │
│  assignee_id (FK → users)               │
│  created_by  (FK → users)               │
│  created_at      updated_at             │
└─────────────────────────────────────────┘
```

---

## 🔐 Role-Based Access Control

| Action | Admin | Member |
|---|---|---|
| View project & tasks | ✅ All tasks | ✅ Own tasks only |
| Create task | ✅ Assign to anyone | ✅ Self-assigned only |
| Update task fields | ✅ All fields | ✅ Status only, own tasks |
| Delete task | ✅ Any task | ✅ Tasks they created |
| Invite / remove members | ✅ | ❌ |
| Change member role | ✅ | ❌ |
| Edit / delete project | ✅ | ❌ |

RBAC is enforced at the **API layer** via FastAPI dependency injection — the frontend hides controls accordingly, but the backend independently validates every request regardless.

---

## 🌐 API Reference

### Authentication — `/api/v1/auth`

| Method | Path | Description |
|---|---|---|
| `POST` | `/signup` | Register a new account |
| `POST` | `/login` | Login → returns JWT pair + sets httpOnly cookies |
| `POST` | `/refresh` | Issue new token pair using refresh token |
| `POST` | `/logout` | Clears auth cookies |
| `GET` | `/me` | Returns current user profile |

### Projects — `/api/v1/projects`

| Method | Path | Role | Description |
|---|---|---|---|
| `GET` | `/` | Any | List all joined projects |
| `POST` | `/` | Authenticated | Create project (creator → admin automatically) |
| `GET` | `/{id}` | Member | Get project detail + members |
| `PATCH` | `/{id}` | Admin | Update name / description |
| `DELETE` | `/{id}` | Admin | Delete project |
| `POST` | `/{id}/members` | Admin | Add member by email |
| `PATCH` | `/{id}/members/{uid}` | Admin | Change member role |
| `DELETE` | `/{id}/members/{uid}` | Admin | Remove member |

### Tasks — `/api/v1/projects/{id}/tasks`

| Method | Path | Role | Description |
|---|---|---|---|
| `GET` | `/` | Member | List tasks (scope filtered by role) |
| `POST` | `/` | Member | Create task |
| `GET` | `/{tid}` | Member | Get single task |
| `PATCH` | `/{tid}` | Member | Update task (RBAC enforced per field) |
| `DELETE` | `/{tid}` | Member | Delete task (RBAC enforced) |

**Query params on `GET /tasks`:** `?status=todo\|in_progress\|done` · `?overdue_only=true` · `?assignee_id=<uuid>`

### Dashboard — `/api/v1/dashboard`

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Stats: project count, task counts by status, overdue count, recent 5 tasks |

> Full interactive docs with request/response schemas: **https://projecttracker-production-0b68.up.railway.app/docs**

---

## 💻 Local Development

### Prerequisites
- Python 3.11+
- Node.js 20+
- PostgreSQL 15+ running locally

### Backend

```bash
cd Backend

python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

pip install -r requirements.txt

cp .env.example .env
# Edit .env — fill in DATABASE_URL and SECRET_KEY

uvicorn app.main:app --reload --port 8000
```

Tables are created automatically on first startup. Visit **http://localhost:8000/docs** for Swagger UI.

### Frontend

```bash
cd frontend-next

npm install

echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

npm run dev
```

Visit **http://localhost:3000**

---

## 🚂 Railway Deployment

The app runs as **3 Railway services** in one project:

```
Railway Project
├── PostgreSQL   (plugin — managed DB, zero config)
├── api          (FastAPI — Dockerfile in /Backend)
└── web          (Next.js — Dockerfile in /frontend-next)
```

### Steps

**1. Create Railway project** — Dashboard → New Project → Empty Project

**2. Add PostgreSQL** — New → Database → PostgreSQL → copy the `DATABASE_URL`

**3. Deploy the backend**
- New → GitHub Repo → Root Directory: `/Backend`
- Environment variables:
  ```
  DATABASE_URL=<postgres URL — change scheme to postgresql+asyncpg://>
  SECRET_KEY=<python -c "import secrets; print(secrets.token_hex(32))">
  FRONTEND_URL=https://<your-frontend-railway-domain>
  ```

**4. Deploy the frontend**
- New → GitHub Repo → Root Directory: `/frontend-next`
- Environment variables:
  ```
  NEXT_PUBLIC_API_URL=https://<your-backend-railway-domain>
  ```

**5. Verify**
```bash
curl https://<api-domain>/health
# → {"status":"ok","service":"project-tracker-api"}
```

---

## 🔧 Environment Variables

### Backend (`Backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL URL (`postgresql+asyncpg://...`) |
| `SECRET_KEY` | ✅ | — | Random 32-byte hex string for JWT signing |
| `ALGORITHM` | | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | | `30` | Access token lifetime (minutes) |
| `REFRESH_TOKEN_EXPIRE_DAYS` | | `7` | Refresh token lifetime (days) |
| `FRONTEND_URL` | ✅ | `http://localhost:3000` | CORS allowed origin |

### Frontend (`frontend-next/.env.local`)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | ✅ | Full URL of the FastAPI backend |

---

## 📐 Key Design Decisions

**Async SQLAlchemy + asyncpg** — FastAPI is built on async I/O; pairing it with an async ORM and driver means DB queries never block the event loop, even under concurrent load.

**JWT in httpOnly cookies** — Tokens in `httpOnly` cookies are invisible to JavaScript, eliminating XSS-based token theft. The Axios client also sends tokens as `Authorization: Bearer` headers for Swagger / Postman access.

**Dependency injection for RBAC** — FastAPI's `Depends()` system chains auth guards cleanly: `get_current_user → get_project_member → require_project_admin`. Each layer adds one check and raises a precise HTTP error on failure — no scattered `if` blocks.

**TanStack Query for server state** — Handles caching, background refetching, and loading/error states without Redux boilerplate. Mutations automatically invalidate affected queries so the dashboard and task lists stay in sync.

**Single Railway project** — Services in the same Railway project share a private internal network. The backend talks to PostgreSQL internally (low latency, no egress cost) while the frontend is publicly accessible.

---

## 👤 Author

Built as part of the **Ethara AI Software Engineer** technical assessment.
