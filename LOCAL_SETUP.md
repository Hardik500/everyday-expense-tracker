# Local Development Setup

This guide helps you configure your local development environment to mirror production as closely as possible.

## Current Setup Overview

### Production Stack
- **Backend**: Railway + PostgreSQL (from Railway)
- **Frontend**: Vercel
- **Auth**: Supabase Auth
- **Storage**: PostgreSQL (Railway)
- **APIs**: Google Cloud (Gmail OAuth + Gemini AI)

### Local Stack
- **Backend**: Python/FastAPI (localhost:8000)
- **Frontend**: Vite dev server (localhost:5173)
- **Auth**: Supabase Auth (shared with production)
- **Storage**: PostgreSQL (Supabase, shared with production) ⚠️
- **APIs**: Google Cloud (shared with production)

## ⚠️ Important Notes

**Your local backend is currently using the PRODUCTION database!**

Look at `backend/.env`:
```
DATABASE_URL=postgresql://postgres.wljvvrwsgakfflflexbv:...@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
```

This means **local changes affect production data**. We should fix this!

---

## Recommended Setup: Local Supabase

### Option 1: Supabase Local Development (Recommended)

Run a local Supabase instance with Docker:

#### 1. Install Supabase CLI

```bash
npm install supabase --save-dev
```

#### 2. Initialize Supabase

```bash
npx supabase init
```

#### 3. Start Local Supabase

```bash
npx supabase start
```

This will:
- Start a local PostgreSQL database
- Start local Supabase Auth
- Start local Supabase Studio (database UI)
- Give you local credentials

#### 4. Configure Backend

Update `backend/.env`:

```bash
# Local PostgreSQL from Supabase
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres

# Supabase Auth
SUPABASE_URL=http://localhost:54321
SUPABASE_JWT_SECRET=<from supabase start output>

# Your API keys (same as production)
GEMINI_API_KEY=<your-key>
GOOGLE_CLIENT_ID=<your-key>
GOOGLE_CLIENT_SECRET=<your-key>
GOOGLE_REDIRECT_URI=http://localhost:5173/auth/google/callback
```

#### 5. Configure Frontend

Create `frontend/.env.local`:

```bash
# Local backend API
VITE_API_URL=http://localhost:8000

# Local Supabase
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<from supabase start output>
```

#### 6. Apply Database Migrations

```bash
cd backend
# Run existing migrations
npx supabase db push
```

---

### Option 2: Separate Supabase Project (Alternative)

Create a separate Supabase project for development:

1. Go to [supabase.com](https://supabase.com)
2. Create new project: "expense-tracker-dev"
3. Copy the connection string and credentials

Update `backend/.env`:
```bash
DATABASE_URL=<dev-project-database-url>
SUPABASE_URL=<dev-project-url>
SUPABASE_JWT_SECRET=<dev-project-jwt-secret>
```

Update `frontend/.env.local`:
```bash
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=<dev-project-url>
VITE_SUPABASE_ANON_KEY=<dev-project-anon-key>
```

---

## Quick Start Script

Create `scripts/dev.sh`:

```bash
#!/bin/bash
# Start local development environment

echo "🚀 Starting Expense Tracker Development Environment"

# Start local Supabase
echo "📦 Starting local Supabase..."
npx supabase start &

# Wait for Supabase
sleep 5

# Start backend
echo "🔧 Starting backend..."
cd backend
source venv/bin/activate || python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload &

# Start frontend
echo "🎨 Starting frontend..."
cd ../frontend
npm install
npm run dev &

echo "✅ Development environment ready!"
echo "   Frontend: http://localhost:5173"
echo "   Backend: http://localhost:8000"
echo "   Supabase Studio: http://localhost:54323"
```

Make it executable:
```bash
chmod +x scripts/dev.sh
```

---

## Environment Files Checklist

### Root `.env`
```bash
GEMINI_API_KEY=your-key
```

### Backend `backend/.env`
```bash
# Local Supabase PostgreSQL
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres

# Supabase Auth
SUPABASE_URL=http://localhost:54321
SUPABASE_JWT_SECRET=<from-local-supabase>

# API Keys
GEMINI_API_KEY=<your-key>
SECRET_KEY=<generate-one>

# Google OAuth (use test credentials or production)
GOOGLE_CLIENT_ID=<your-key>
GOOGLE_CLIENT_SECRET=<your-key>
GOOGLE_REDIRECT_URI=http://localhost:5173/auth/google/callback

# Gmail Worker (disable for local)
ENABLE_GMAIL_WORKER=false
```

### Frontend `frontend/.env.local`
```bash
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<from-local-supabase>
```

---

## Differences: Local vs Production

| Feature | Local | Production |
|---------|-------|------------|
| Database | Local PostgreSQL (via Supabase) | Railway PostgreSQL |
| Auth | Local Supabase Auth | Supabase Cloud Auth |
| Backend URL | `http://localhost:8000` | `https://api.everydayexpensetracker.online` |
| Frontend URL | `http://localhost:5173` | `https://www.everydayexpensetracker.online` |
| Gmail Worker | Disabled (manual testing) | Enabled (background) |
| CORS | Localhost only | Production domains only |

---

## Testing Production-like Features Locally

### Test Supabase Auth
1. Start local Supabase
2. Access Supabase Studio: http://localhost:54323
3. View Auth → Users to see local test users

### Test Gmail OAuth
1. Update Google OAuth redirect URIs to include `http://localhost:5173/auth/google/callback`
2. Enable Gmail worker: `ENABLE_GMAIL_WORKER=true`
3. Test OAuth flow from Profile page

### Test Database Migrations
```bash
cd backend
# Apply all migrations
python scripts/migrate.py
```

---

## Troubleshooting

### Backend can't connect to database
- Check if Supabase is running: `npx supabase status`
- Verify DATABASE_URL in `backend/.env`

### Frontend can't authenticate
- Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
- Restart frontend dev server after env changes

### Gmail OAuth fails
- Verify redirect URI in Google Cloud Console
- Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET

---

## Next Steps

1. ✅ Install Supabase CLI
2. ✅ Start local Supabase
3. ✅ Update environment files
4. ✅ Test authentication flow
5. ✅ Create test data locally
6. ✅ Never touch production DB from local again! 🎉
