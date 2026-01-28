# Quick Setup Guide: Local Development with Production Data

Follow these steps to get your local environment running with a copy of production data:

## 1. Install PostgreSQL Tools (if not already installed)

```bash
# Ubuntu/Debian
sudo apt-get install postgresql-client

# macOS
brew install postgresql
```

## 2. Make Sure Local Supabase is Running

```bash
supabase status
# If not running: supabase start
```

## 3. Copy Production Data to Local (ONE-TIME)

```bash
./scripts/copy-prod-to-local.sh
```

This will:
- Dump your production database
- Restore it to your local Supabase
- Clean up temporary files

**⚠️ Note**: This only copies your app data (users, transactions, accounts, etc.). It does NOT copy Supabase Auth users. You'll need to create test users locally.

## 4. Create a Test User (Local Auth)

Visit Supabase Studio: http://127.0.0.1:54323

1. Go to **Authentication** → **Users**
2. Click **Add user** → **Create new user**
3. Enter:
   - Email: `test@example.com`
   - Password: `password123`
   - Auto Confirm User: ✅ **Check this box**

## 5. Start Your Development Servers

### Option A: Manual Start

```bash
# Terminal 1: Backend
cd backend
source venv/bin/activate
python -m uvicorn app.main:app --reload

# Terminal 2: Frontend
cd frontend
npm run dev
```

### Option B: Automated Start (TODO: Create this script)

```bash
./scripts/start-dev.sh
```

## 6. Access Your Local App

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Supabase Studio**: http://127.0.0.1:54323

## 7. Login

Use the test user you created:
- Email: `test@example.com`
- Password: `password123`

---

## Troubleshooting

### "pg_dump: command not found"
Install PostgreSQL client tools (see step 1)

### Database connection refused
Make sure Supabase is running: `supabase status`

### Frontend shows auth errors
1. Check `frontend/.env.local` has correct Supabase URL
2. Make sure you created a test user in local Supabase
3. Try clearing browser localStorage and cookies

### Backend errors about missing tables
The production data should have created all tables. If not:
```bash
cd backend
# Run migrations manually
python scripts/migrate.py
```

---

## What's Different from Production?

| Feature | Production | Local |
|---------|-----------|-------|
| Database | Railway PostgreSQL | Local Supabase PostgreSQL |
| Auth Users | Real users | Test users (create manually) |
| Gmail Worker | Enabled (background) | Disabled |
| Data | Real production data | Copy (frozen in time) |

---

## Sync Data Again (if needed)

If you want to refresh your local data with the latest from production:

```bash
./scripts/copy-prod-to-local.sh
```

This will wipe your local data and replace it with a fresh copy from production.

---

## Next Steps

You're all set! You can now:
- ✅ Develop locally without affecting production
- ✅ Test features with real-looking data
- ✅ Create test users to simulate different scenarios
- ✅ Debug issues safely

Happy coding! 🚀
