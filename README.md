# Expense Tracker

Local-first expense tracker with CSV/OFX/XLS/PDF ingestion, rule-based categorization, and a review queue.

## Backend (FastAPI)
- Install deps: `pip install -r backend/requirements.txt`
- Run API: `uvicorn app.main:app --reload --app-dir backend`
- CLI import: `python -m app.cli <account_id> <file_path> --source csv --profile generic`

## Frontend (Vite + React)
- Install deps: `npm install` in `frontend/`
- Run: `npm run dev`

## Notes
- Database lives at `backend/data/expense.db` by default.
- Seed categories and starter rules are applied on first startup.
- Optional statement seeding: set `SEED_STATEMENTS_DIR=/home/hardik/projects/expense-tracker/statements`.
- Optional AI categorization: set `AI_PROVIDER` and wire a provider in `backend/app/rules/ai.py`.
