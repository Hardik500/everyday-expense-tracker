# Expense Tracker - Deployment Guide

This guide covers deploying the Expense Tracker application using the **Split Platform** architecture:
- **Frontend**: Vercel
- **Backend**: Railway
- **Database**: Supabase (PostgreSQL)

## Prerequisites

- [Supabase](https://supabase.com) account
- [Railway](https://railway.app) account
- [Vercel](https://vercel.com) account
- Git repository (GitHub recommended)

---

## Phase 1: Database Setup (Supabase)

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Choose a name (e.g., `expense-tracker`)
4. Set a strong database password (save this!)
5. Select a region close to your users

### 2. Get Connection String

1. Go to **Project Settings** → **Database**
2. Copy the connection string under "Connection string" → "URI"
3. It will look like: `postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres`
4. Replace `[PASSWORD]` with your database password

### 3. Run Migrations

1. Go to **SQL Editor** in Supabase dashboard
2. Copy the contents of `backend/app/migrations_pg/0001_init_postgres.sql`
3. Paste and run in the SQL editor
4. Verify tables are created in **Table Editor**

---

## Phase 2: Backend Deployment (Railway)

### 1. Connect Repository

1. Go to [railway.app](https://railway.app) and sign in
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Choose the `backend` directory as the root (or configure in settings)

### 2. Configure Environment Variables

In Railway dashboard, add these environment variables:

| Variable | Value |
| :--- | :--- |
| `DATABASE_URL` | Your Supabase connection string |
| `SECRET_KEY` | Generate with `python -c "import secrets; print(secrets.token_urlsafe(32))"` |
| `GEMINI_API_KEY` | Your Google AI API key |
| `CORS_ORIGINS` | `https://your-app.vercel.app` (update after Vercel deploy) |

### 3. Deploy

Railway will automatically deploy. Once complete:
1. Go to **Settings** → **Networking**
2. Generate a domain (e.g., `expense-tracker-backend.up.railway.app`)
3. Test: `curl https://your-domain.railway.app/health`

---

## Phase 3: Frontend Deployment (Vercel)

### 1. Connect Repository

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Set Root Directory to `frontend`

### 2. Configure Build Settings

| Setting | Value |
| :--- | :--- |
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |

### 3. Add Environment Variables

| Variable | Value |
| :--- | :--- |
| `VITE_API_URL` | Your Railway backend URL (e.g., `https://expense-tracker-backend.up.railway.app`) |

### 4. Deploy

Click "Deploy" and wait for completion. Your app will be available at `https://your-project.vercel.app`.

---

## Phase 4: Post-Deployment

### Update CORS Origins

1. Go back to Railway
2. Update `CORS_ORIGINS` to include your Vercel domain
3. Redeploy the backend

### Connect Custom Domain (Optional)

**Vercel:**
1. Go to Project Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed

**Railway:**
1. Go to Settings → Networking
2. Add custom domain
3. Update DNS as instructed

---

## Local Development

```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Edit with your values
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
cp .env.example .env.local  # Edit with your values
npm run dev
```

---

## Cost Estimate

| Service | Free Tier | Pro Tier |
| :--- | :--- | :--- |
| Supabase | 500MB storage | $25/mo |
| Railway | $5 credits/mo | $20/mo |
| Vercel | Unlimited | $20/mo |
| **Total** | **~$5/mo** | **~$65/mo** |

---

## Troubleshooting

### "Connection refused" on frontend
- Check `VITE_API_URL` is set correctly in Vercel
- Ensure Railway backend is running
- Verify CORS settings include your Vercel domain

### Database connection errors
- Verify `DATABASE_URL` is correct in Railway
- Check Supabase is not paused (free tier pauses after inactivity)
- Ensure migrations were run successfully

### Migrations not applying
- For PostgreSQL, run migrations manually via Supabase SQL Editor
- The app will not auto-run migrations on PostgreSQL

---

## Architecture Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     Vercel      │     │     Railway     │     │    Supabase     │
│   (Frontend)    │────▶│    (Backend)    │────▶│   (PostgreSQL)  │
│   React + Vite  │     │    FastAPI      │     │   + Storage     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │
         │                       │
         ▼                       ▼
    Global CDN              Auto-scaling
    Free SSL                Health checks
```
