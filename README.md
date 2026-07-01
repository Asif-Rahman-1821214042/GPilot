# GxPilot

GxPilot is a pharmaceutical GxP document workflow app for drafting SOP/APQR documents, scanning them with Gemini-backed compliance review, storing reports in PostgreSQL, and reviewing records with an audit trail.

## Stack

- Frontend: React, Vite, TypeScript, Tailwind, lucide-react
- Backend: FastAPI, Python, google-genai
- Database: PostgreSQL
- Database admin: pgAdmin
- Runtime: Docker Compose

## Services

| Service | URL | Purpose |
| --- | --- | --- |
| Frontend | http://localhost:3000 | GxPilot web app |
| Backend API | http://localhost:8000 | FastAPI API |
| pgAdmin | http://localhost:5050 | PostgreSQL admin UI |
| PostgreSQL | localhost:5432 | App database |

## Setup

1. Copy the sample environment file:

```bash
cp .env.example .env
```

2. Edit `.env` and set at least:

```bash
GEMINI_API_KEY="your_gemini_api_key"
POSTGRES_PASSWORD="change_me"
PGADMIN_DEFAULT_PASSWORD="change_me"
```

3. Build and start everything:

```bash
docker compose up --build
```

4. Open the app:

```text
http://localhost:3000
```

pgAdmin is available at `http://localhost:5050`. The PostgreSQL server is registered automatically from `docker/pgadmin/servers.json`.

## Common Commands

Start services:

```bash
docker compose up -d
```

Rebuild frontend and backend:

```bash
docker compose build backend frontend
docker compose up -d --force-recreate backend frontend
```

View logs:

```bash
docker compose logs -f backend
docker compose logs -f frontend
```

Check service status:

```bash
docker compose ps
```

Run frontend typecheck:

```bash
docker compose exec -T frontend npm run lint
```

Run backend syntax check:

```bash
docker compose exec -T backend python -m py_compile app/main.py app/gemini.py app/database.py
```

## Main Features

- SOP drafting with GxP-focused structure.
- APQR compilation with batch, deviation, stability, quality-system, validation, market-event, and supplier/material inputs.
- SOP/APQR-specific compliance scans.
- Compliance reports saved in PostgreSQL so documents are not rescanned every time.
- Risk findings include AI mitigation suggestions.
- Section-wise document editing with live preview.
- Re-finalizing an edited document saves the update and generates a new compliance report.
- 21 CFR Part 11 style review/signoff flow and immutable audit trail.
- Direct PDF download from the document preview.

## Project Layout

```text
.
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI routes and document workflow
│   │   ├── gemini.py        # Gemini prompts and AI calls
│   │   └── database.py      # PostgreSQL setup/access
│   ├── Dockerfile
│   └── requirements.txt
├── docker/
│   └── pgadmin/servers.json # Auto-registers Postgres in pgAdmin
├── src/
│   ├── components/          # React UI components
│   ├── types.ts
│   └── main.tsx
├── Dockerfile.frontend
├── docker-compose.yml
└── .env.example
```

## API Notes

Useful endpoints:

- `GET /api/health/`
- `GET /api/documents`
- `GET /api/documents/{document_id}`
- `POST /api/documents/draft-sop`
- `POST /api/documents/draft-apqr`
- `PUT /api/documents/{document_id}`
- `POST /api/documents/{document_id}/scan`
- `POST /api/documents/{document_id}/action`

## Environment Variables

See [.env.example](.env.example) for the full list.

Important values:

- `GEMINI_API_KEY`: required for Gemini generation and compliance scans.
- `MODEL`: Gemini model name.
- `GEMINI_TIMEOUT_SECONDS`: socket timeout for AI calls.
- `MAX_ANALYSIS_CHARS`: maximum document text sent to the compliance scan.
- `POSTGRES_*`: database settings used by backend and Docker Compose.
- `PGADMIN_DEFAULT_*`: pgAdmin login.

## Data Persistence

PostgreSQL and pgAdmin data are stored in Docker volumes:

- `gxpilot_pgdb_data`
- `gxpilot_pgadmin_data`

To remove all local database/admin data:

```bash
docker compose down -v
```

## Notes

- `.env` is intentionally ignored. Do not commit secrets.
- Healthcheck requests are filtered out of backend access logs to keep terminal output readable.
- AI-generated compliance findings are decision support and should be reviewed by qualified QA personnel before release.
