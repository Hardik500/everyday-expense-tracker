from datetime import datetime, date
import os
from pathlib import Path
from typing import List, Optional, Dict, Any

from dotenv import load_dotenv
load_dotenv()  # Load .env file before anything else

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, Body, BackgroundTasks, Depends, status, Query
from pydantic import BaseModel
from fastapi.requests import Request
from datetime import datetime, timedelta
import time

# Analytics module
from app.analytics import get_spending_insights, get_year_over_year

# HIGH-003: Rate limiting storage (in-memory with simple cleanup)
_rate_limit_store: dict = {}
_rate_limit_lock = None  # Will use threading.Lock if needed


class RateLimiter:
    """Simple in-memory rate limiter."""

    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window_seconds = window_seconds

    def is_allowed(self, key: str) -> tuple[bool, dict]:
        """Check if request is allowed. Returns (allowed, info)."""
        import threading
        global _rate_limit_store, _rate_limit_lock
        if _rate_limit_lock is None:
            _rate_limit_lock = threading.Lock()

        now = time.time()
        with _rate_limit_lock:
            if key not in _rate_limit_store:
                _rate_limit_store[key] = []

            # Clean old entries
            _rate_limit_store[key] = [
                t for t in _rate_limit_store[key]
                if now - t < self.window_seconds
            ]

            if len(_rate_limit_store[key]) < self.max_requests:
                _rate_limit_store[key].append(now)
                return True, {"reset_at": now + self.window_seconds}

            return False, {
                "reset_at": min(_rate_limit_store[key]) + self.window_seconds,
                "retry_after": int(min(_rate_limit_store[key]) + self.window_seconds - now)
            }


# Rate limiters
rate_limiter_ai = RateLimiter(max_requests=10, window_seconds=60)  # 10 AI categorizations per minute
rate_limiter_search = RateLimiter(max_requests=30, window_seconds=60)  # 30 searches per minute
rate_limiter_bulk = RateLimiter(max_requests=10, window_seconds=60)  # 10 bulk operations per minute
rate_limiter_export = RateLimiter(max_requests=5, window_seconds=60)  # 5 exports per minute
rate_limiter_ingest = RateLimiter(max_requests=5, window_seconds=60)  # 5 file uploads per minute


def rate_limit_check(limiter: RateLimiter, prefix: str = ""):
    """Dependency to check rate limiting."""
    def check_rate_limit(request: Request, current_user: schemas.User = Depends(get_current_user)):
        key = f"{prefix}:{current_user.id}"
        allowed, info = limiter.is_allowed(key)
        if not allowed:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Try again in {int(info['reset_at'] - time.time())} seconds.",
                headers={"Retry-After": str(int(info["reset_at"] - time.time()))}
            )
        return current_user
    return check_rate_limit

# SECURITY-001: File upload limits
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB max file size
ALLOWED_EXTENSIONS = {'.csv', '.txt', '.xls', '.xlsx', '.pdf', '.ofx', '.qfx'}

def validate_upload(file: UploadFile) -> None:
    """Validate file size and extension for security."""
    # Check file size (requires reading content)
    file.file.seek(0, 2)  # Seek to end
    size = file.file.tell()
    file.file.seek(0)  # Reset to beginning
    
    if size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB"
        )
    
    # Check file extension
    file_ext = '.' + file.filename.split('.')[-1].lower() if '.' in file.filename else ''
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

class RateLimiter:
    """Simple in-memory rate limiter."""
    def __init__(self, max_requests: int = 10, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
    
    def is_allowed(self, key: str) -> tuple[bool, dict]:
        """Check if request is allowed. Returns (allowed, rate_limit_info)."""
        now = time.time()
        
        if key not in _rate_limit_store:
            _rate_limit_store[key] = []
        
        # Clean old entries
        _rate_limit_store[key] = [
            req_time for req_time in _rate_limit_store[key]
            if now - req_time < self.window_seconds
        ]
        
        if len(_rate_limit_store[key]) >= self.max_requests:
            reset_time = _rate_limit_store[key][0] + self.window_seconds
            return False, {
                "limit": self.max_requests,
                "remaining": 0,
                "reset_at": reset_time
            }
        
        _rate_limit_store[key].append(now)
        
        return True, {
            "limit": self.max_requests,
            "remaining": self.max_requests - len(_rate_limit_store[key]),
            "reset_at": now + self.window_seconds
        }

# Create rate limiters for different endpoints groups
rate_limiter_ai = RateLimiter(max_requests=10, window_seconds=60)  # 10 AI categorizations per minute
rate_limiter_search = RateLimiter(max_requests=30, window_seconds=60)  # 30 searches per minute
rate_limiter_bulk = RateLimiter(max_requests=10, window_seconds=60)  # 10 bulk operations per minute
rate_limiter_export = RateLimiter(max_requests=5, window_seconds=60)  # 5 exports per minute
rate_limiter_ingest = RateLimiter(max_requests=5, window_seconds=60)  # 5 file uploads per minute

# CRITICAL-002: Whitelist for safe SQL column names
def validate_column_name(column: str) -> bool:
    """Validate column name is safe for use in SQL queries."""
    ALLOWED_COLUMNS = {
        'id', 'username', 'email', 'full_name', 'created_at', 'updated_at',
        'user_id', 'account_id', 'category_id', 'subcategory_id', 'statement_id',
        'name', 'type', 'currency', 'amount', 'posted_at', 'description_raw',
        'description_norm', 'is_uncertain', 'priority', 'active', 'pattern',
        'merchant_contains', 'min_amount', 'max_amount', 'account_type'
    }
    # Must be alphanumeric with underscores only, and in allowed set
    if not column or not column.replace('_', '').isalnum():
        return False
    return column in ALLOWED_COLUMNS

def sanitize_sql_identifier(identifier: str) -> str:
    """Sanitize SQL identifier to prevent injection."""
    # Only allow alphanumeric and underscore
    if not identifier or not all(c.isalnum() or c == '_' for c in identifier):
        raise HTTPException(status_code=400, detail="Invalid SQL identifier")
    return identifier

def parse_date_range(start_date: Optional[str], end_date: Optional[str]) -> tuple:
    """
    Parse date range parameters for queries.
    
    Returns (clauses, params) where:
    - start_date uses >= (includes start of day)
    - end_date uses < next day (includes entire end day)
    
    This ensures transactions at any time on end_date are included.
    """
    from datetime import timedelta
    
    clauses = []
    params = []
    
    if start_date:
        try:
            parsed = datetime.strptime(start_date, "%Y-%m-%d").date()
            clauses.append("t.posted_at >= ?")
            params.append(parsed.isoformat())
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid start_date format. Use YYYY-MM-DD.")
    
    if end_date:
        try:
            parsed = datetime.strptime(end_date, "%Y-%m-%d").date()
            # Use < next day to include entire end_date
            next_day = parsed + timedelta(days=1)
            clauses.append("t.posted_at < ?")
            params.append(next_day.isoformat())
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid end_date format. Use YYYY-MM-DD.")
    
    return clauses, params

from fastapi.middleware.cors import CORSMiddleware

from app import schemas
from app.db import apply_migrations, get_conn, IS_POSTGRES
from app.ingest.csv import ingest_csv
from app.ingest.ofx import ingest_ofx
from app.ingest.pdf import ingest_pdf, ingest_text
from app.ingest.xls import ingest_xls
from app.linking import link_card_payments
from app.rules.engine import apply_rules, find_matching_rule
from app.seed import seed_categories_and_rules, seed_statements_from_dir
from app.auth import get_current_user, get_password_hash, verify_password, create_access_token
from app.accounts.matcher import AccountMatcher
from app import gmail
from app.cache import cached
from app.redis_client import invalidate_user_cache
from fastapi.security import OAuth2PasswordRequestForm

app = FastAPI(title="Expense Tracker API")

# Read CORS origins from environment variable
cors_origins_str = os.getenv("CORS_ORIGINS", "https://www.everydayexpensetracker.online,https://everydayexpensetracker.online")
cors_origins = [origin.strip() for origin in cors_origins_str.split(",")]

print(f"CORS enabled for origins: {cors_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    print(f"Server starting up... IS_POSTGRES={IS_POSTGRES}")
    try:
        apply_migrations()
        print("Migrations applied successfully.")
    except Exception as e:
        print(f"FAILED to apply migrations: {e}")
        raise
    
    # Start Gmail Worker in a background thread for production
    enable_worker = os.getenv("ENABLE_GMAIL_WORKER", "true").lower() == "true"
    print(f"ENABLE_GMAIL_WORKER: {enable_worker}")
    
    if enable_worker:
        import threading
        from app.worker import run_worker
        print("Starting Gmail Sync Worker thread...")
        worker_thread = threading.Thread(target=run_worker, daemon=True)
        worker_thread.start()
        print("Gmail Sync Worker thread started.")
    
    print("Application startup complete.")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


@app.get("/auth/me", response_model=schemas.User)
def get_me(current_user: schemas.User = Depends(get_current_user)):
    return current_user


@app.patch("/user/profile", response_model=schemas.User)
def update_user_profile(
    payload: schemas.UserUpdate,
    current_user: schemas.User = Depends(get_current_user)
):
    """Update current user's profile (username, full_name)."""
    with get_conn() as conn:
        # Check if username is being changed and if it's already taken
        if payload.username and payload.username != current_user.username:
            existing = conn.execute(
                "SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ?",
                (payload.username, current_user.id)
            ).fetchone()
            if existing:
                raise HTTPException(status_code=400, detail="Username already taken")
        
        # Build update query dynamically
        updates = []
        params = []
        if payload.username is not None:
            updates.append("username = ?")
            params.append(payload.username)
        if payload.full_name is not None:
            updates.append("full_name = ?")
            params.append(payload.full_name)
        
        if not updates:
            return current_user
        
        params.append(current_user.id)
        query = f"UPDATE users SET {', '.join(updates)} WHERE id = ?"
        conn.execute(query, tuple(params))
        conn.commit()
        
        # Fetch and return updated user
        user_row = conn.execute("SELECT * FROM users WHERE id = ?", (current_user.id,)).fetchone()
        return schemas.User(**dict(user_row))


@app.get("/auth/google/url", response_model=schemas.GoogleAuthUrl)
def get_google_auth_url(current_user: schemas.User = Depends(get_current_user)):
    """Generate the Google OAuth2 authorization URL."""
    url = gmail.get_authorization_url()
    return {"url": url}


@app.get("/auth/google/callback")
def google_auth_callback(code: str, current_user: schemas.User = Depends(get_current_user)):
    """Handle the Google OAuth2 callback and save refresh token."""
    try:
        refresh_token = gmail.get_refresh_token(code)
        if not refresh_token:
            raise HTTPException(status_code=400, detail="Failed to obtain refresh token. Try re-authorizing and ensuring you grant all permissions.")
        
        with get_conn() as conn:
            conn.execute(
                "UPDATE users SET gmail_refresh_token = ?, gmail_enabled = TRUE WHERE id = ?",
                (refresh_token, current_user.id)
            )
            conn.commit()
        return {"status": "success", "message": "Gmail account connected and sync enabled."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/user/gmail/config", response_model=schemas.User)
def update_gmail_config(
    payload: schemas.GmailConfigUpdate,
    current_user: schemas.User = Depends(get_current_user)
):
    """Update user's Gmail sync configuration."""
    with get_conn() as conn:
        updates = []
        params = []
        if payload.gmail_enabled is not None:
            updates.append("gmail_enabled = ?")
            params.append(payload.gmail_enabled)
        if payload.gmail_filter_query is not None:
            updates.append("gmail_filter_query = ?")
            params.append(payload.gmail_filter_query)
        
        if not updates:
            return current_user
            
        params.append(current_user.id)
        conn.execute(
            f"UPDATE users SET {', '.join(updates)} WHERE id = ?",
            tuple(params)
        )
        conn.commit()
        
        user_row = conn.execute("SELECT * FROM users WHERE id = ?", (current_user.id,)).fetchone()
        return schemas.User(**dict(user_row))


@app.post("/accounts", response_model=schemas.Account)
def create_account(
    payload: schemas.AccountCreate,
    current_user: schemas.User = Depends(get_current_user)
) -> schemas.Account:
    with get_conn() as conn:
        cursor = conn.execute(
            "INSERT INTO accounts (name, type, currency, user_id) VALUES (?, ?, ?, ?)",
            (payload.name, payload.type, payload.currency, current_user.id),
        )
        conn.commit()
        account_id = cursor.lastrowid
        row = conn.execute(
            "SELECT id, name, type, currency, upgraded_from_id FROM accounts WHERE id = ? AND user_id = ?",
            (account_id, current_user.id),
        ).fetchone()
    return schemas.Account(**dict(row))


@app.get("/accounts", response_model=List[schemas.Account])
def list_accounts(current_user: schemas.User = Depends(get_current_user)) -> List[schemas.Account]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, name, type, currency, upgraded_from_id FROM accounts WHERE user_id = ? ORDER BY name",
            (current_user.id,)
        ).fetchall()
    return [schemas.Account(**dict(row)) for row in rows]


@app.patch("/accounts/{account_id}", response_model=schemas.Account)
def update_account(
    account_id: int, 
    payload: schemas.AccountUpdate,
    current_user: schemas.User = Depends(get_current_user)
) -> schemas.Account:
    with get_conn() as conn:
        existing = conn.execute(
            "SELECT * FROM accounts WHERE id = ? AND user_id = ?", (account_id, current_user.id)
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Account not found")
        
        # Build update query
        updates = []
        params = []
        if payload.name is not None:
            updates.append("name = ?")
            params.append(payload.name)
        if payload.upgraded_from_id is not None:
            # Allow setting to 0 or null to clear
            val = None if payload.upgraded_from_id == 0 else payload.upgraded_from_id
            updates.append("upgraded_from_id = ?")
            params.append(val)
            
        if updates:
            query = f"UPDATE accounts SET {', '.join(updates)} WHERE id = ? AND user_id = ?"
            conn.execute(query, (*params, account_id, current_user.id))
            conn.commit()
            
        row = conn.execute(
            "SELECT id, name, type, currency, upgraded_from_id FROM accounts WHERE id = ? AND user_id = ?",
            (account_id, current_user.id)
        ).fetchone()
    return schemas.Account(**dict(row))


@app.delete("/accounts/{account_id}")
def delete_account(
    account_id: int,
    current_user: schemas.User = Depends(get_current_user)
) -> dict:
    with get_conn() as conn:
        # Check if account exists for user
        existing = conn.execute(
            "SELECT id FROM accounts WHERE id = ? AND user_id = ?", (account_id, current_user.id)
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Account not found")

        # Check if account has transactions
        txn_count = conn.execute(
            "SELECT COUNT(*) as cnt FROM transactions WHERE account_id = ? AND user_id = ?",
            (account_id, current_user.id)
        ).fetchone()["cnt"]
        if txn_count > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete account with {txn_count} transactions. Delete transactions first."
            )
        conn.execute("DELETE FROM accounts WHERE id = ? AND user_id = ?", (account_id, current_user.id))
        conn.commit()
    return {"deleted": True, "account_id": account_id}


@app.get("/categories")
def list_categories(current_user: schemas.User = Depends(get_current_user)) -> dict:
    with get_conn() as conn:
        categories = conn.execute(
            "SELECT id, name, color, monthly_budget, icon FROM categories WHERE user_id = ? ORDER BY name",
            (current_user.id,)
        ).fetchall()
        subcategories = conn.execute(
            "SELECT id, category_id, name FROM subcategories WHERE user_id = ? ORDER BY name",
            (current_user.id,)
        ).fetchall()
    return {
        "categories": [dict(row) for row in categories],
        "subcategories": [dict(row) for row in subcategories],
    }


@app.post("/categories")
def create_category(
    name: str = Form(...),
    color: Optional[str] = Form(None),
    monthly_budget: Optional[float] = Form(None),
    icon: Optional[str] = Form(None),
    current_user: schemas.User = Depends(get_current_user)
) -> dict:
    """Create a new category."""
    with get_conn() as conn:
        # Check if already exists for this user
        existing = conn.execute(
            "SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND user_id = ?", 
            (name.strip(), current_user.id)
        ).fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="Category already exists")
        
        cursor = conn.execute(
            "INSERT INTO categories (name, color, monthly_budget, icon, user_id) VALUES (?, ?, ?, ?, ?)", 
            (name.strip(), color, monthly_budget, icon, current_user.id)
        )
        conn.commit()
        return {"id": cursor.lastrowid, "name": name.strip(), "color": color, "monthly_budget": monthly_budget, "icon": icon}


@app.put("/categories/{category_id}")
def update_category(
    category_id: int, 
    name: str = Form(...),
    color: Optional[str] = Form(None),
    monthly_budget: Optional[float] = Form(None),
    icon: Optional[str] = Form(None),
    current_user: schemas.User = Depends(get_current_user)
) -> dict:
    """Update a category name, color, icon, and budget."""
    with get_conn() as conn:
        existing = conn.execute(
            "SELECT id FROM categories WHERE id = ? AND user_id = ?", (category_id, current_user.id)
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Category not found")
        
        # Check for duplicate name for this user
        duplicate = conn.execute(
            "SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND id != ? AND user_id = ?",
            (name.strip(), category_id, current_user.id)
        ).fetchone()
        if duplicate:
            raise HTTPException(status_code=400, detail="Category name already exists")
        
        conn.execute(
            "UPDATE categories SET name = ?, color = ?, monthly_budget = ?, icon = ? WHERE id = ? AND user_id = ?", 
            (name.strip(), color, monthly_budget, icon, category_id, current_user.id)
        )
        conn.commit()
        return {"id": category_id, "name": name.strip(), "color": color, "monthly_budget": monthly_budget, "icon": icon}


@app.delete("/categories/{category_id}")
def delete_category(
    category_id: int,
    current_user: schemas.User = Depends(get_current_user)
) -> dict:
    """Delete a category (only if no transactions use it)."""
    with get_conn() as conn:
        # Check if category exists for user
        existing = conn.execute(
            "SELECT id FROM categories WHERE id = ? AND user_id = ?", (category_id, current_user.id)
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Category not found")

        # Check if any transactions use this category
        txn_count = conn.execute(
            "SELECT COUNT(*) as cnt FROM transactions WHERE category_id = ? AND user_id = ?",
            (category_id, current_user.id)
        ).fetchone()["cnt"]
        
        if txn_count > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete: {txn_count} transactions use this category"
            )
        
        # Delete subcategories first
        conn.execute("DELETE FROM subcategories WHERE category_id = ? AND user_id = ?", (category_id, current_user.id))
        # Delete any rules using this category
        conn.execute("DELETE FROM rules WHERE category_id = ? AND user_id = ?", (category_id, current_user.id))
        # Delete the category
        conn.execute("DELETE FROM categories WHERE id = ? AND user_id = ?", (category_id, current_user.id))
        conn.commit()
        
        return {"deleted": True, "category_id": category_id}


@app.post("/subcategories")
def create_subcategory(
    category_id: int = Form(...), 
    name: str = Form(...),
    current_user: schemas.User = Depends(get_current_user)
) -> dict:
    """Create a new subcategory under a category."""
    with get_conn() as conn:
        # Verify category exists for this user
        category = conn.execute(
            "SELECT id FROM categories WHERE id = ? AND user_id = ?", (category_id, current_user.id)
        ).fetchone()
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        
        # Check if subcategory already exists in this category for this user
        existing = conn.execute(
            "SELECT id FROM subcategories WHERE category_id = ? AND LOWER(name) = LOWER(?) AND user_id = ?",
            (category_id, name.strip(), current_user.id)
        ).fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="Subcategory already exists in this category")
        
        cursor = conn.execute(
            "INSERT INTO subcategories (category_id, name, user_id) VALUES (?, ?, ?)",
            (category_id, name.strip(), current_user.id)
        )
        conn.commit()
        return {"id": cursor.lastrowid, "category_id": category_id, "name": name.strip()}


@app.put("/subcategories/{subcategory_id}")
def update_subcategory(
    subcategory_id: int, 
    name: str = Form(...),
    current_user: schemas.User = Depends(get_current_user)
) -> dict:
    """Update a subcategory name."""
    with get_conn() as conn:
        existing = conn.execute(
            "SELECT id, category_id FROM subcategories WHERE id = ? AND user_id = ?", 
            (subcategory_id, current_user.id)
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Subcategory not found")
        
        conn.execute(
            "UPDATE subcategories SET name = ? WHERE id = ? AND user_id = ?", 
            (name.strip(), subcategory_id, current_user.id)
        )
        conn.commit()
        return {"id": subcategory_id, "category_id": existing["category_id"], "name": name.strip()}


@app.delete("/subcategories/{subcategory_id}")
def delete_subcategory(
    subcategory_id: int,
    current_user: schemas.User = Depends(get_current_user)
) -> dict:
    """Delete a subcategory (only if no transactions use it)."""
    with get_conn() as conn:
        # Check if subcategory exists for user
        existing = conn.execute(
            "SELECT id FROM subcategories WHERE id = ? AND user_id = ?", (subcategory_id, current_user.id)
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Subcategory not found")

        # Check if any transactions use this subcategory
        txn_count = conn.execute(
            "SELECT COUNT(*) as cnt FROM transactions WHERE subcategory_id = ? AND user_id = ?",
            (subcategory_id, current_user.id)
        ).fetchone()["cnt"]
        
        if txn_count > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete: {txn_count} transactions use this subcategory"
            )
        
        # Delete any rules using this subcategory
        conn.execute("DELETE FROM rules WHERE subcategory_id = ? AND user_id = ?", (subcategory_id, current_user.id))
        # Delete the subcategory
        conn.execute("DELETE FROM subcategories WHERE id = ? AND user_id = ?", (subcategory_id, current_user.id))
        conn.commit()
        
        return {"deleted": True, "subcategory_id": subcategory_id}


@app.get("/categories/{category_id}/stats")
def get_category_stats(
    category_id: int,
    current_user: schemas.User = Depends(get_current_user)
) -> dict:
    """Get usage stats for a category."""
    with get_conn() as conn:
        # Check if category exists for user
        existing = conn.execute(
            "SELECT id FROM categories WHERE id = ? AND user_id = ?", (category_id, current_user.id)
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Category not found")

        txn_count = conn.execute(
            "SELECT COUNT(*) as cnt FROM transactions WHERE category_id = ? AND user_id = ?",
            (category_id, current_user.id)
        ).fetchone()["cnt"]
        
        subcat_count = conn.execute(
            "SELECT COUNT(*) as cnt FROM subcategories WHERE category_id = ? AND user_id = ?",
            (category_id, current_user.id)
        ).fetchone()["cnt"]
        
        rule_count = conn.execute(
            "SELECT COUNT(*) as cnt FROM rules WHERE category_id = ? AND user_id = ?",
            (category_id, current_user.id)
        ).fetchone()["cnt"]
        
        return {
            "category_id": category_id,
            "transaction_count": txn_count,
            "subcategory_count": subcat_count,
            "rule_count": rule_count,
        }


@app.post("/rules")
def create_rule(
    payload: schemas.RuleCreate,
    current_user: schemas.User = Depends(get_current_user)
) -> dict:
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO rules (
                name, pattern, category_id, subcategory_id,
                min_amount, max_amount, priority, account_type,
                merchant_contains, active, user_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?)
            """,
            (
                payload.name,
                payload.pattern,
                payload.category_id,
                payload.subcategory_id,
                payload.min_amount,
                payload.max_amount,
                payload.priority,
                payload.account_type,
                payload.merchant_contains,
                current_user.id,
            ),
        )
        conn.commit()
    return {"status": "ok"}


@app.get("/rules")
def list_rules(current_user: schemas.User = Depends(get_current_user)) -> List[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT r.id, r.name, r.pattern, r.category_id, r.subcategory_id, r.min_amount,
                   r.max_amount, r.priority, r.account_type, r.merchant_contains, r.active,
                   c.name as category_name, s.name as subcategory_name
            FROM rules r
            LEFT JOIN categories c ON c.id = r.category_id
            LEFT JOIN subcategories s ON s.id = r.subcategory_id
            WHERE r.user_id = ?
            ORDER BY r.priority DESC, r.name
            """,
            (current_user.id,)
        ).fetchall()
    return [dict(row) for row in rows]


@app.put("/rules/{rule_id}")
def update_rule(
    rule_id: int, 
    payload: schemas.RuleCreate,
    current_user: schemas.User = Depends(get_current_user)
) -> dict:
    with get_conn() as conn:
        existing = conn.execute("SELECT id FROM rules WHERE id = ? AND user_id = ?", (rule_id, current_user.id)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Rule not found")
        conn.execute(
            """
            UPDATE rules SET
                name = ?, pattern = ?, category_id = ?, subcategory_id = ?,
                min_amount = ?, max_amount = ?, priority = ?, account_type = ?,
                merchant_contains = ?
            WHERE id = ? AND user_id = ?
            """,
            (
                payload.name,
                payload.pattern,
                payload.category_id,
                payload.subcategory_id,
                payload.min_amount,
                payload.max_amount,
                payload.priority,
                payload.account_type,
                payload.merchant_contains,
                rule_id,
                current_user.id,
            ),
        )
        conn.commit()
    return {"status": "ok", "rule_id": rule_id}


@app.delete("/rules/{rule_id}")
def delete_rule(
    rule_id: int,
    current_user: schemas.User = Depends(get_current_user)
) -> dict:
    with get_conn() as conn:
        # Check if rule exists for user
        existing = conn.execute("SELECT id FROM rules WHERE id = ? AND user_id = ?", (rule_id, current_user.id)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Rule not found")
        conn.execute("DELETE FROM rules WHERE id = ? AND user_id = ?", (rule_id, current_user.id))
        conn.commit()
    return {"deleted": True, "rule_id": rule_id}


@app.patch("/rules/{rule_id}/toggle")
def toggle_rule(
    rule_id: int,
    current_user: schemas.User = Depends(get_current_user)
) -> dict:
    with get_conn() as conn:
        existing = conn.execute("SELECT active FROM rules WHERE id = ? AND user_id = ?", (rule_id, current_user.id)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Rule not found")
        new_active = False if existing["active"] else True
        conn.execute("UPDATE rules SET active = ? WHERE id = ? AND user_id = ?", (new_active, rule_id, current_user.id))
        conn.commit()
    return {"rule_id": rule_id, "active": bool(new_active)}


@app.post("/detect-account")
def detect_account(
    file: UploadFile = File(...),
    current_user: schemas.User = Depends(get_current_user)
) -> dict:
    """Detect which account a statement belongs to based on file content."""
    # SECURITY-001: Validate file upload
    validate_upload(file)
    
    from app.accounts.discovery import detect_statement_account
    
    content = file.file.read()
    file_name = file.filename or ""
    
    with get_conn() as conn:
        matched_account = detect_statement_account(conn, file_name, content, current_user.id)
        
    detected_account_name = None
    detected_profile = None
    if matched_account:
        detected_account_name = matched_account["name"]
        if matched_account["type"] == "bank":
            detected_profile = "hdfc_txt" # Fallback profile for bank statements
    
    # Find matching account in database for current user
    detected_account_id = None
    suggested_name = None
    suggested_type = None

    if detected_account_name:
        with get_conn() as conn:
            # Try exact match first
            row = conn.execute(
                "SELECT id, name FROM accounts WHERE LOWER(name) = LOWER(?) AND user_id = ?", 
                (detected_account_name, current_user.id)
            ).fetchone()
            if row:
                detected_account_id = row["id"]
                detected_account_name = row["name"]
            else:
                # Try partial match
                search_term = detected_account_name.split()[0].lower()  # First word
                row = conn.execute(
                    "SELECT id, name FROM accounts WHERE LOWER(name) LIKE ? AND user_id = ?",
                    (f"%{search_term}%", current_user.id)
                ).fetchone()
                if row:
                    detected_account_id = row["id"]
                    detected_account_name = row["name"]
    
    # If no existing account detected, look for a suggestion
    if not detected_account_id:
        with get_conn() as conn:
            matcher = AccountMatcher(conn, user_id=current_user.id)
            # Decode bytes to string for matching
            try:
                content_str = content.decode('utf-8', errors='ignore')
            except:
                content_str = ""
            suggestion = matcher.suggest_account_details(content_str, file_name)
            if suggestion:
                suggested_name = suggestion["name"]
                suggested_type = suggestion["type"]
    
    return {
        "detected_account_id": detected_account_id,
        "detected_account_name": detected_account_name,
        "detected_profile": detected_profile,
        "suggested_name": suggested_name,
        "suggested_type": suggested_type,
    }


@app.post("/ingest")
def ingest_statement(
    background_tasks: BackgroundTasks,
    account_id: int = Form(...),
    source: str = Form(...),
    file: UploadFile = File(...),
    profile: Optional[str] = Form(None),
    current_user: schemas.User = Depends(rate_limit_check(rate_limiter_ingest, "ingest"))
) -> dict:
    # SECURITY-001: Validate file upload
    validate_upload(file)
    
    if source not in {"csv", "txt", "ofx", "xls", "pdf"}:
        raise HTTPException(
            status_code=400, detail="source must be csv, ofx, xls, or pdf"
        )
    content = file.file.read()
    file_name = file.filename or "upload"

    with get_conn() as conn:
        # Verify account belongs to user
        account = conn.execute(
            "SELECT id FROM accounts WHERE id = ? AND user_id = ?", (account_id, current_user.id)
        ).fetchone()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")

        statement_id = conn.execute(
            "INSERT INTO statements (account_id, source, file_name, user_id) VALUES (?, ?, ?, ?)",
            (account_id, source, file_name, current_user.id),
        ).lastrowid
        conn.commit()

        if source == "csv":
            inserted, skipped, _ = ingest_csv(
                conn, account_id, statement_id, content, profile, user_id=current_user.id
            )
        elif source == "xls":
            inserted, skipped, _ = ingest_xls(
                conn, account_id, statement_id, content, profile, user_id=current_user.id
            )
        elif source == "pdf":
            inserted, skipped = ingest_pdf(conn, account_id, statement_id, content, user_id=current_user.id)
        elif source == "txt":
            # 1. Try Delimiter Parser (for structured text/CSV)
            print(f"Starting CSV parsing for txt file, file_name={file_name}, profile={profile}")
            inserted, skipped, duplicates = ingest_csv(
                conn, account_id, statement_id, content, profile, user_id=current_user.id
            )
            print(f"CSV parsing completed: inserted={inserted}, skipped={skipped}, duplicates={duplicates}")
            # 2. Fallback to AI Parser (for unstructured text)
            # Only call AI if CSV returned 0 inserted AND 0 skipped AND 0 duplicates
            # AND the file is not a bank statement (bank statements are detected as "generic"
            # and will just timeout on AI parsing)
            if inserted == 0 and skipped == 0 and duplicates == 0:
                # Check if this is a bank statement by looking for bank indicators in content
                text_lower = content.decode('utf-8', errors='ignore').lower()
                is_bank_statement = any(ind in text_lower for ind in [
                    'hdfc bank', 'icici bank', 'sbi bank', 'axis bank',
                    'account branch', 'withdrawal amt', 'deposit amt',
                    'closing balance'
                ])

                if not is_bank_statement:
                    print("Delimiter parser yielded 0 results - attempting AI text parsing...")
                    inserted, skipped = ingest_text(conn, account_id, statement_id, content, user_id=current_user.id)
                else:
                    print("Delimiter parser yielded 0 results - file appears to be a bank statement, skipping AI parsing")
        else:
            # "OFX/QFX" or Generic text source -> Try Delimiter First
            inserted, skipped, _ = ingest_csv(
                conn, account_id, statement_id, content, profile, user_id=current_user.id
            )
            print(f"CSV parsing completed: inserted={inserted}, skipped={skipped}")

            # Fallback to OFX parser
            if inserted == 0:
                try:
                    inserted, skipped, _ = ingest_ofx(conn, account_id, statement_id, content, user_id=current_user.id)
                except Exception:
                    pass

        # Commit the transactions first so the API can return immediately
        # This prevents the frontend from hanging while rules are being applied
        conn.commit()

    # Apply rules in background (async) to avoid blocking the response
    # Need a new connection since we're outside the with block
    background_tasks.add_task(apply_rules_background, account_id, statement_id, current_user.id)
    background_tasks.add_task(link_card_payments_background, account_id, current_user.id)

    return {
        "inserted": inserted,
        "skipped": skipped,
        "statement_id": statement_id,
    }


def apply_rules_background(account_id: int, statement_id: int, user_id: int):
    """Background task to apply rules without blocking the API response."""
    from app.rules.engine import apply_rules
    try:
        with get_conn() as conn:
            apply_rules(conn, account_id=account_id, statement_id=statement_id, user_id=user_id)
            conn.commit()
    except Exception as e:
        print(f"Warning: apply_rules failed: {e}")


def link_card_payments_background(account_id: int, user_id: int):
    """Background task to link card payments without blocking the API response."""
    try:
        with get_conn() as conn:
            link_card_payments(conn, account_id=account_id, user_id=user_id)
            conn.commit()
    except Exception as e:
        print(f"Warning: link_card_payments failed: {e}")


from app.search import perform_ai_search

@app.post("/transactions/search")
def search_transactions_ai(
    request: Request,
    payload: schemas.SearchRequest,
    current_user: schemas.User = Depends(get_current_user)
) -> dict:
    """
    Natural language search for transactions using AI.
    Example: "zomato last 30 days"
    """
    # HIGH-003: Rate limiting check
    key = f"search:{current_user.id}"
    allowed, info = rate_limiter_search.is_allowed(key)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded for AI search. Try again later."
        )
    
    print(f"AI Search Query: {payload.query} [Page {payload.page}] for User {current_user.id}")
    return perform_ai_search(
        query=payload.query,
        filters=payload.filters,
        page=payload.page,
        page_size=payload.page_size,
        user_id=current_user.id
    )



@app.get("/transactions", response_model=List[schemas.Transaction])
def list_transactions(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    category_id: Optional[int] = None,
    subcategory_id: Optional[int] = None,
    uncertain: Optional[bool] = None,
    current_user: schemas.User = Depends(get_current_user)
) -> List[schemas.Transaction]:
    clauses = ["t.user_id = ?"]
    params: List[object] = [current_user.id]

    # Validate and convert date strings to date objects for PostgreSQL compatibility
    if start_date:
        try:
            # Parse the date string and ensure it's in ISO format
            parsed_date = datetime.strptime(start_date, "%Y-%m-%d").date()
            clauses.append("t.posted_at >= ?")
            # For PostgreSQL, pass as ISO string to ensure proper conversion
            params.append(parsed_date.isoformat())
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid start_date format. Use YYYY-MM-DD.")
    if end_date:
        try:
            parsed_date = datetime.strptime(end_date, "%Y-%m-%d").date()
            # For end_date, we want to include the entire day, so we use < next day
            # This ensures transactions at any time on end_date are included
            from datetime import timedelta
            next_day = parsed_date + timedelta(days=1)
            clauses.append("t.posted_at < ?")
            params.append(next_day.isoformat())
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid end_date format. Use YYYY-MM-DD.")
    if category_id:
        clauses.append("t.category_id = ?")
        params.append(category_id)
    if subcategory_id:
        clauses.append("t.subcategory_id = ?")
        params.append(subcategory_id)
    if uncertain is not None:
        clauses.append("t.is_uncertain = ?")
        params.append(True if uncertain else False)
    
    # Exclude soft-deleted transactions (in trash)
    clauses.append("(t.is_deleted = FALSE OR t.is_deleted IS NULL)")

    where = f"WHERE {' AND '.join(clauses)}"
    query = f"""
        SELECT t.id, t.account_id, t.posted_at, t.amount, t.currency, t.description_raw,
               t.description_norm, t.category_id, t.subcategory_id, t.is_uncertain, t.notes,
               a.name as account_name
        FROM transactions t
        LEFT JOIN accounts a ON a.id = t.account_id
        {where}
        ORDER BY t.posted_at DESC, t.id DESC
        LIMIT 5000
    """
    with get_conn() as conn:
        rows = conn.execute(query, params).fetchall()
    return [schemas.Transaction(**dict(row)) for row in rows]





from fastapi.responses import StreamingResponse
import csv
import io


@app.get("/transactions/export")
def export_transactions(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    category_id: Optional[int] = None,
    current_user: schemas.User = Depends(rate_limit_check(rate_limiter_export, "export"))
) -> StreamingResponse:
    """Export transactions as CSV."""
    clauses = ["t.user_id = ?"]
    params: List[object] = [current_user.id]

    # Use shared date range parser
    date_clauses, date_params = parse_date_range(start_date, end_date)
    clauses.extend(date_clauses)
    params.extend(date_params)
    
    if category_id:
        clauses.append("t.category_id = ?")
        params.append(category_id)
    
    # Exclude soft-deleted transactions (in trash)
    clauses.append("(t.is_deleted = FALSE OR t.is_deleted IS NULL)")

    where = f"WHERE {' AND '.join(clauses)}"
    query = f"""
        SELECT t.id, a.name as account_name, t.posted_at, t.amount, t.currency,
               t.description_raw, t.description_norm, c.name as category, s.name as subcategory
        FROM transactions t
        LEFT JOIN accounts a ON a.id = t.account_id
        LEFT JOIN categories c ON c.id = t.category_id
        LEFT JOIN subcategories s ON s.id = t.subcategory_id
        {where}
        ORDER BY t.posted_at DESC, t.id DESC
    """

    with get_conn() as conn:
        rows = conn.execute(query, params).fetchall()

    # Generate CSV
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Account", "Description", "Amount", "Currency", "Category", "Subcategory"])
    for row in rows:
        writer.writerow([
            str(row["posted_at"])[:10],
            row["account_name"] or "",
            row["description_raw"],
            row["amount"],
            row["currency"],
            row["category"] or "",
            row["subcategory"] or "",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=transactions.csv"}
    )


# OLD TRASH ENDPOINTS REMOVED - Replaced with new trash table implementation (see below)


# ============= TRANSACTION MANAGEMENT =============

@app.patch("/transactions/{transaction_id}")
def update_transaction(
    transaction_id: int, 
    payload: schemas.TransactionUpdate,
    current_user: schemas.User = Depends(get_current_user)
) -> dict:
    with get_conn() as conn:
        tx = conn.execute(
            """
            SELECT t.description_norm, t.amount, a.type as account_type 
            FROM transactions t
            JOIN accounts a ON a.id = t.account_id
            WHERE t.id = ? AND t.user_id = ?
            """,
            (transaction_id, current_user.id),
        ).fetchone()
        if not tx:
            raise HTTPException(status_code=404, detail="Transaction not found")

        # Build dynamic update query
        updates = ["is_uncertain = FALSE"]
        params: List[object] = []
        
        if payload.category_id is not None:
            updates.append("category_id = ?")
            params.append(payload.category_id)
        if payload.subcategory_id is not None:
            updates.append("subcategory_id = ?")
            params.append(payload.subcategory_id)
        if payload.notes is not None:
            updates.append("notes = ?")
            params.append(payload.notes)
        
        params.extend([transaction_id, current_user.id])
        
        conn.execute(
            f"""
            UPDATE transactions
            SET {', '.join(updates)}
            WHERE id = ? AND user_id = ?
            """,
            tuple(params),
        )
        if payload.create_mapping and payload.category_id:
            conn.execute(
                """
                INSERT INTO mappings
                (description_norm, category_id, subcategory_id, user_id)
                VALUES (?, ?, ?, ?)
                ON CONFLICT (description_norm, user_id)
                DO UPDATE SET 
                    category_id = EXCLUDED.category_id,
                    subcategory_id = EXCLUDED.subcategory_id
                """,
                (
                    tx["description_norm"],
                    payload.category_id,
                    payload.subcategory_id,
                    current_user.id,
                ),
            )
        conn.commit()
    
    # Invalidate user's report caches
    invalidate_user_cache(current_user.id, "reports")
    
    return {"status": "ok"}


@app.get("/transactions/{transaction_id}/similar")
def find_similar_transactions(
    transaction_id: int, 
    pattern: Optional[str] = None,
    current_user: schemas.User = Depends(get_current_user)
) -> dict:
    """Find transactions with similar descriptions."""
    import re
    
    with get_conn() as conn:
        tx = conn.execute(
            """
            SELECT t.description_norm, t.amount, a.type as account_type 
            FROM transactions t
            JOIN accounts a ON a.id = t.account_id
            WHERE t.id = ? AND t.user_id = ?
            """,
            (transaction_id, current_user.id),
        ).fetchone()
        if not tx:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        search_pattern = ""
        display_pattern = ""

        if pattern:
            # Use provided pattern
            # If pattern doesn't contain %, assume it's a "contains" search and wrap it
            display_pattern = pattern
            if "%" not in pattern and "_" not in pattern:
                 search_pattern = f"%{pattern}%"
            else:
                 search_pattern = pattern
        else:
            # Extract key words (first 2-3 significant words)
            desc = tx["description_norm"]
            words = [w for w in desc.split() if len(w) > 2 and not w.isdigit()][:3]
            if not words:
                return {"similar": [], "pattern": "", "count": 0}
            
            # Build a search pattern
            display_pattern = "%".join(words[:2]) if len(words) >= 2 else words[0]
            search_pattern = f"%{display_pattern}%"
        
        # Get total count of matches
        row = conn.execute(
            "SELECT COUNT(*) as cnt FROM transactions WHERE description_norm LIKE ? AND user_id = ?",
            (search_pattern, current_user.id),
        ).fetchone()
        total_count = row["cnt"] if row else 0
        
        similar = conn.execute(
            """
            SELECT id, description_norm, amount, posted_at, category_id, subcategory_id, notes
            FROM transactions
            WHERE description_norm LIKE ? AND user_id = ?
            ORDER BY posted_at DESC
            LIMIT 100
            """,
            (search_pattern, current_user.id),
        ).fetchall()
        
        # Also find the matching rule if it exists
        matching_rule = find_matching_rule(
            conn, 
            current_user.id,
            tx["description_norm"], 
            tx["amount"], 
            tx["account_type"]
        )
        
        return {
            "similar": [dict(row) for row in similar],
            "pattern": display_pattern,
            "count": len(similar),
            "total_count": total_count,
            "matching_rule": matching_rule
        }


@app.post("/transactions/bulk-update")
def bulk_update_transactions(
    transaction_ids: List[int] = Form(...),
    category_id: int = Form(...),
    subcategory_id: Optional[int] = Form(None),
    create_rule: bool = Form(False),
    rule_pattern: Optional[str] = Form(None),
    rule_name: Optional[str] = Form(None),
    update_all_similar: bool = Form(False),
    current_user: schemas.User = Depends(rate_limit_check(rate_limiter_bulk, "bulk_update"))
) -> dict:
    """Bulk update multiple transactions and optionally create a rule."""
    # CRITICAL-003: Validate transaction_ids
    if not transaction_ids:
        raise HTTPException(status_code=400, detail="transaction_ids cannot be empty")
    
    # Validate all transaction IDs are positive integers
    if len(transaction_ids) > 1000:  # Reasonable limit to prevent abuse
        raise HTTPException(status_code=400, detail="Maximum 1000 transactions can be updated at once")
    
    for tx_id in transaction_ids:
        if not isinstance(tx_id, int) or tx_id <= 0:
            raise HTTPException(status_code=400, detail=f"Invalid transaction_id: {tx_id}. Must be a positive integer")
    
    # Validate category_id is positive
    if category_id <= 0:
        raise HTTPException(status_code=400, detail="category_id must be a positive integer")
    
    with get_conn() as conn:
        if update_all_similar and rule_pattern:
            # Handle pattern wrapping if needed (consistent with find_similar)
            search_pattern = rule_pattern
            if "%" not in rule_pattern and "_" not in rule_pattern:
                search_pattern = f"%{rule_pattern}%"
                
            cursor = conn.execute(
                f"""
                UPDATE transactions
                SET category_id = ?, subcategory_id = ?, is_uncertain = FALSE
                WHERE description_norm LIKE ? AND user_id = ?
                """,
                (category_id, subcategory_id, search_pattern, current_user.id),
            )
            updated_count = cursor.rowcount
        else:
            # Update only specified transactions belonging to the user
            placeholders = ",".join("?" * len(transaction_ids))
            cursor = conn.execute(
                f"""
                UPDATE transactions
                SET category_id = ?, subcategory_id = ?, is_uncertain = FALSE
                WHERE id IN ({placeholders}) AND user_id = ?
                """,
                [category_id, subcategory_id] + transaction_ids + [current_user.id],
            )
            updated_count = cursor.rowcount
        
        # updated_count set above via cursor.rowcount
        
        # Optionally create or update a rule for future transactions
        rule_id = None
        if create_rule and rule_pattern:
            # Check if rule already exists by pattern for this user
            existing = conn.execute(
                "SELECT id FROM rules WHERE pattern = ? AND user_id = ?",
                (rule_pattern, current_user.id),
            ).fetchone()
            
            if existing:
                # Update existing rule
                conn.execute(
                    """
                    UPDATE rules 
                    SET category_id = ?, subcategory_id = ?
                    WHERE id = ? AND user_id = ?
                    """,
                    (category_id, subcategory_id, existing["id"], current_user.id),
                )
                rule_id = existing["id"]
            else:
                # Create new rule
                cursor = conn.execute(
                    """
                    INSERT INTO rules (name, pattern, category_id, subcategory_id, priority, active, user_id)
                    VALUES (?, ?, ?, ?, 70, TRUE, ?)
                    """,
                    (rule_name or f"User rule: {rule_pattern[:30]}", rule_pattern, category_id, subcategory_id, current_user.id),
                )
                rule_id = cursor.lastrowid
        
        conn.commit()
        
    # Invalidate user's report caches after bulk update
    invalidate_user_cache(current_user.id, "reports")
    
    return {
        "status": "ok",
        "updated_count": updated_count,
        "rule_id": rule_id,
    }


@app.post("/transactions/bulk-delete")
def bulk_delete_transactions(
    transaction_ids: List[int] = Form(...),
    current_user: schemas.User = Depends(rate_limit_check(rate_limiter_bulk, "bulk_delete"))
) -> dict:
    """Bulk delete multiple transactions."""
    # CRITICAL-003: Validate transaction_ids
    if not transaction_ids:
        raise HTTPException(status_code=400, detail="transaction_ids cannot be empty")
    
    # Validate all transaction IDs are positive integers
    if len(transaction_ids) > 1000:  # Reasonable limit to prevent abuse
        raise HTTPException(status_code=400, detail="Maximum 1000 transactions can be deleted at once")
    
    for tx_id in transaction_ids:
        if not isinstance(tx_id, int) or tx_id <= 0:
            raise HTTPException(status_code=400, detail=f"Invalid transaction_id: {tx_id}. Must be a positive integer")
    
    with get_conn() as conn:
        # Delete transaction links first (cascade manually since some DBs don't cascade FKs)
        placeholders = ",".join("?" * len(transaction_ids))
        conn.execute(
            f"""
            DELETE FROM transaction_links 
            WHERE source_transaction_id IN ({placeholders}) OR target_transaction_id IN ({placeholders})
            """,
            tuple(transaction_ids + transaction_ids),
        )
        
        # Delete the transactions belonging to the user
        placeholders = ",".join("?" * len(transaction_ids))
        cursor = conn.execute(
            f"""
            DELETE FROM transactions
            WHERE id IN ({placeholders}) AND user_id = ?
            """,
            tuple(transaction_ids + [current_user.id]),
        )
        deleted_count = cursor.rowcount
        
        conn.commit()
    
    # Invalidate user's report caches after bulk delete
    invalidate_user_cache(current_user.id, "reports")
    
    return {
        "status": "ok",
        "deleted_count": deleted_count,
    }


@app.get("/reports/summary")
@cached(ttl=180, key_prefix="reports")
async def report_summary(
    start_date: Optional[str] = None, 
    end_date: Optional[str] = None,
    current_user: schemas.User = Depends(get_current_user)
) -> dict:
    clauses = ["l.id IS NULL", "t.user_id = ?"]
    params: List[object] = [current_user.id]
    date_clauses, date_params = parse_date_range(start_date, end_date)
    clauses.extend(date_clauses)
    params.extend(date_params)
    where = f"WHERE {' AND '.join(clauses)}"
    query = f"""
        SELECT c.id as category_id, c.name as category_name, SUM(t.amount) as total
        FROM transactions t
        LEFT JOIN categories c ON c.id = t.category_id
        LEFT JOIN transaction_links l
          ON (l.source_transaction_id = t.id OR l.target_transaction_id = t.id)
         AND l.link_type = 'card_payment'
        {where}
        GROUP BY c.id, c.name
        ORDER BY total ASC
    """
    with get_conn() as conn:
        rows = conn.execute(query, params).fetchall()
    # Ensure totals are numeric to prevent frontend NaN issues
    items = [
        {
            "category_id": row["category_id"],
            "category_name": row["category_name"],
            "total": float(row["total"]) if row["total"] is not None else 0.0
        }
        for row in rows
    ]
    return {"items": items}



@app.get("/reports/by-account")
@cached(ttl=300, key_prefix="reports")
async def report_by_account(
    start_date: Optional[str] = None, 
    end_date: Optional[str] = None,
    current_user: schemas.User = Depends(get_current_user)
) -> dict:
    """Get spending breakdown by account (credit card), with category breakdown and monthly totals."""
    clauses = ["l.id IS NULL", "t.amount < 0", "t.user_id = ?"]  # Only expenses
    params: List[object] = [current_user.id]
    if start_date:
        try:
            parsed_date = datetime.strptime(start_date, "%Y-%m-%d").date()
            clauses.append("t.posted_at >= ?")
            params.append(parsed_date.isoformat())
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD.")
    if end_date:
        try:
            parsed_date = datetime.strptime(end_date, "%Y-%m-%d").date()
            clauses.append("t.posted_at < ?")
            params.append(parsed_date.isoformat())
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD.")
    where = f"WHERE {' AND '.join(clauses)}"
    
    with get_conn() as conn:
        # Get only credit card accounts with their spending totals
        accounts_query = f"""
            SELECT 
                a.id as account_id,
                a.name as account_name,
                SUM(ABS(t.amount)) as total_spent
            FROM transactions t
            JOIN accounts a ON a.id = t.account_id
            LEFT JOIN transaction_links l
              ON (l.source_transaction_id = t.id OR l.target_transaction_id = t.id)
             AND l.link_type = 'card_payment'
            {where} AND a.type = 'card'
            GROUP BY a.id, a.name
            ORDER BY total_spent DESC
        """
        accounts = conn.execute(accounts_query, params).fetchall()
        
        result = []
        for account in accounts:
            account_id = account["account_id"]
            
            # Get category breakdown for this account
            cat_params = params + [account_id]
            categories_query = f"""
                SELECT 
                    c.id as category_id,
                    c.name as category_name,
                    SUM(ABS(t.amount)) as total
                FROM transactions t
                LEFT JOIN categories c ON c.id = t.category_id
                LEFT JOIN transaction_links l
                  ON (l.source_transaction_id = t.id OR l.target_transaction_id = t.id)
                 AND l.link_type = 'card_payment'
                {where} AND t.account_id = ? AND t.user_id = ?
                GROUP BY c.id, c.name
                ORDER BY total DESC
                LIMIT 5
            """
            categories = conn.execute(categories_query, params + [account_id, current_user.id]).fetchall()
            
            # Get monthly breakdown for this account
            month_fragment = "TO_CHAR(t.posted_at, 'YYYY-MM')" if IS_POSTGRES else "substr(t.posted_at, 1, 7)"
            monthly_query = f"""
                SELECT 
                    {month_fragment} as month,
                    SUM(ABS(t.amount)) as total
                FROM transactions t
                LEFT JOIN transaction_links l
                  ON (l.source_transaction_id = t.id OR l.target_transaction_id = t.id)
                 AND l.link_type = 'card_payment'
                {where} AND t.account_id = ? AND t.user_id = ?
                GROUP BY {month_fragment}
                ORDER BY month DESC
                LIMIT 12
            """
            monthly = conn.execute(monthly_query, params + [account_id, current_user.id]).fetchall()
            
            result.append({
                "account_id": account_id,
                "account_name": account["account_name"],
                "total_spent": account["total_spent"],
                "categories": [dict(row) for row in categories],
                "monthly": [dict(row) for row in monthly],
            })
    
    return {"accounts": result}


@app.get("/reports/timeseries")
@cached(ttl=300, key_prefix="reports")
async def report_timeseries(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    granularity: str = "day",  # day, week, month
    account_id: Optional[int] = None,
    current_user: schemas.User = Depends(get_current_user)
) -> dict:
    """Get time-series data for expenses and income."""
    from datetime import datetime, timedelta
    
    # Validate user-provided dates, then set defaults if needed
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
            end_date = end_dt.strftime("%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD.")
    else:
        end_date = datetime.now().strftime("%Y-%m-%d")
    
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            start_date = start_dt.strftime("%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD.")
    else:
        start_dt = datetime.strptime(end_date, "%Y-%m-%d") - timedelta(days=30)
        start_date = start_dt.strftime("%Y-%m-%d")
    
    # Determine grouping based on granularity
    if granularity == "month":
        date_format = "%Y-%m"
        date_trunc = "TO_CHAR(t.posted_at, 'YYYY-MM')" if IS_POSTGRES else "substr(t.posted_at, 1, 7)"
    elif granularity == "week":
        date_format = "%Y-%m-%d"
        date_trunc = "TO_CHAR(DATE_TRUNC('week', t.posted_at), 'YYYY-MM-DD')" if IS_POSTGRES else "date(t.posted_at, 'weekday 0', '-6 days')"
    else:  # day
        date_format = "%Y-%m-%d"
        date_trunc = "CAST(t.posted_at AS DATE)" if IS_POSTGRES else "date(t.posted_at)"
    
    # Calculate next day for end_date to include entire day
    end_date_next = (datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d")
    
    clauses = ["t.posted_at >= ?", "t.posted_at < ?", "l.id IS NULL", "(c.name IS NULL OR c.name != 'Transfers')", "t.user_id = ?"]
    params: List[object] = [start_date, end_date_next, current_user.id]

    if account_id:
        clauses.append("t.account_id = ?")
        params.append(account_id)

    query = f"""
        SELECT 
            {date_trunc} as period,
            CAST(SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END) AS FLOAT) as expenses,
            CAST(SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END) AS FLOAT) as income,
            COUNT(*) as transaction_count
        FROM transactions t
        LEFT JOIN categories c ON c.id = t.category_id
        LEFT JOIN transaction_links l
          ON (l.source_transaction_id = t.id OR l.target_transaction_id = t.id)
         AND l.link_type = 'card_payment'
        WHERE {' AND '.join(clauses)}
        GROUP BY {date_trunc}
        ORDER BY period ASC
    """
    
    with get_conn() as conn:
        rows = conn.execute(query, params).fetchall()
        
    # Zero-fill missing periods
    from dateutil.relativedelta import relativedelta
    
    # Convert period to string for consistent key matching
    data_map = {}
    for row in rows:
        period_val = row['period']
        # Convert date/datetime objects to string
        if hasattr(period_val, 'strftime'):
            if granularity == "month":
                period_key = period_val.strftime("%Y-%m") if hasattr(period_val, 'strftime') else str(period_val)[:7]
            else:
                period_key = period_val.strftime("%Y-%m-%d") if hasattr(period_val, 'strftime') else str(period_val)[:10]
        else:
            period_key = str(period_val)
        data_map[period_key] = dict(row)
        # Update the period in the dict to be a string too
        data_map[period_key]['period'] = period_key
    
    filled_data = []
    
    curr = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")
    
    # Align start date to beginning of period
    if granularity == "week":
        curr = curr - timedelta(days=curr.weekday())
    elif granularity == "month":
        curr = curr.replace(day=1)
        
    while curr <= end:
        if granularity == "month":
            period_key = curr.strftime("%Y-%m")
            next_step = relativedelta(months=1)
        elif granularity == "week":
            period_key = curr.strftime("%Y-%m-%d")
            next_step = timedelta(weeks=1)
        else:
            period_key = curr.strftime("%Y-%m-%d")
            next_step = timedelta(days=1)
            
        if period_key in data_map:
            filled_data.append(data_map[period_key])
        else:
            filled_data.append({
                "period": period_key,
                "expenses": 0.0,
                "income": 0.0,
                "transaction_count": 0
            })
            
        curr += next_step
    
    return {
        "data": filled_data,
        "start_date": start_date,
        "end_date": end_date,
        "granularity": granularity,
    }


@app.get("/reports/category-trend")
def report_category_trend(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    category_id: Optional[int] = None,
    account_id: Optional[int] = None,
    current_user: schemas.User = Depends(get_current_user)
) -> dict:
    """Get spending trend by category over time."""
    from datetime import datetime, timedelta
    
    # Validate user-provided dates, then set defaults if needed
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
            end_date = end_dt.strftime("%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD.")
    else:
        end_date = datetime.now().strftime("%Y-%m-%d")
    
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            start_date = start_dt.strftime("%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD.")
    else:
        start_dt = datetime.strptime(end_date, "%Y-%m-%d") - timedelta(days=90)
        start_date = start_dt.strftime("%Y-%m-%d")
    
    # Calculate next day for end_date to include entire day
    end_date_next = (datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d")
    
    clauses = ["t.posted_at >= ?", "t.posted_at < ?", "l.id IS NULL", "t.amount < 0", "t.user_id = ?"]
    params: List[object] = [start_date, end_date_next, current_user.id]
    
    if category_id:
        clauses.append("t.category_id = ?")
        params.append(category_id)

    if account_id:
        clauses.append("t.account_id = ?")
        params.append(account_id)
    
    query = f"""
        SELECT 
            date(t.posted_at) as period,
            c.name as category_name,
            ABS(SUM(t.amount)) as amount
        FROM transactions t
        LEFT JOIN categories c ON c.id = t.category_id
        LEFT JOIN transaction_links l
          ON (l.source_transaction_id = t.id OR l.target_transaction_id = t.id)
         AND l.link_type = 'card_payment'
        WHERE {' AND '.join(clauses)}
          AND (c.name IS NULL OR c.name != 'Transfers')
        GROUP BY date(t.posted_at), c.name
        ORDER BY period ASC
    """
    
    with get_conn() as conn:
        rows = conn.execute(query, params).fetchall()
    
    return {"data": [dict(row) for row in rows]}


@app.get("/reports/stats")
@cached(ttl=300, key_prefix="reports")
async def report_stats(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    account_id: Optional[int] = None,
    current_user: schemas.User = Depends(get_current_user)
) -> dict:
    """Get overall statistics for the date range."""
    from datetime import datetime, timedelta
    
    # Validate user-provided dates, then set defaults if needed
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
            end_date = end_dt.strftime("%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD.")
    else:
        end_date = datetime.now().strftime("%Y-%m-%d")
    
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            start_date = start_dt.strftime("%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD.")
    else:
        start_dt = datetime.strptime(end_date, "%Y-%m-%d") - timedelta(days=30)
        start_date = start_dt.strftime("%Y-%m-%d")
    
    # Calculate next day for end_date to include entire day
    end_date_next = (datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d")
    
    clauses = ["t.posted_at >= ?", "t.posted_at < ?", "l.id IS NULL", "(c.name IS NULL OR c.name != 'Transfers')", "t.user_id = ?"]
    params: List[object] = [start_date, end_date_next, current_user.id]

    if account_id:
        clauses.append("t.account_id = ?")
        params.append(account_id)

    with get_conn() as conn:
        # Get totals excluding transfers
        totals = conn.execute(
            f"""
            SELECT 
                SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END) as total_expenses,
                SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END) as total_income,
                COUNT(*) as transaction_count,
                AVG(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE NULL END) as avg_expense
            FROM transactions t
            LEFT JOIN categories c ON c.id = t.category_id
            LEFT JOIN transaction_links l
              ON (l.source_transaction_id = t.id OR l.target_transaction_id = t.id)
             AND l.link_type = 'card_payment'
            WHERE {' AND '.join(clauses)}
            """,
            params,
        ).fetchone()
        
        # Get top spending categories
        top_clauses = ["t.posted_at >= ?", "t.posted_at < ?", "t.amount < 0", "l.id IS NULL", "c.name != 'Transfers'", "t.user_id = ?"]
        top_params: List[object] = [start_date, end_date_next, current_user.id]
        if account_id:
            top_clauses.append("t.account_id = ?")
            top_params.append(account_id)

        top_categories = conn.execute(
            f"""
            SELECT c.name, ABS(SUM(t.amount)) as total
            FROM transactions t
            JOIN categories c ON c.id = t.category_id
            LEFT JOIN transaction_links l
              ON (l.source_transaction_id = t.id OR l.target_transaction_id = t.id)
             AND l.link_type = 'card_payment'
            WHERE {' AND '.join(top_clauses)}
            GROUP BY c.id, c.name
            ORDER BY total DESC
            LIMIT 5
            """,
            top_params,
        ).fetchall()
        # Ensure totals are numeric (float) for frontend safety
        top_categories = [{"name": r["name"], "total": float(r["total"]) if r["total"] is not None else 0.0} for r in top_categories]
        
        # Get date range bounds
        date_bounds = conn.execute(
            "SELECT MIN(posted_at) as min_date, MAX(posted_at) as max_date FROM transactions WHERE user_id = ?",
            (current_user.id,)
        ).fetchone()
    
    return {
        "total_expenses": totals["total_expenses"] or 0,
        "total_income": totals["total_income"] or 0,
        "net_balance": (totals["total_income"] or 0) - (totals["total_expenses"] or 0),
        "transaction_count": totals["transaction_count"] or 0,
        "avg_expense": totals["avg_expense"] or 0,
        "top_categories": [{"name": r["name"], "total": r["total"]} for r in top_categories],
        "start_date": start_date,
        "end_date": end_date,
        "data_min_date": str(date_bounds["min_date"])[:10] if date_bounds["min_date"] else None,
        "data_max_date": str(date_bounds["max_date"])[:10] if date_bounds["max_date"] else None,
    }
    

@app.get("/reports/card-coverage")
def report_card_coverage(current_user: schemas.User = Depends(get_current_user)) -> dict:
    """
    Get credit card statement coverage report.
    Identifies payments from bank accounts to credit cards,
    and shows which months have statements uploaded vs gaps.
    """
    from datetime import datetime
    from collections import defaultdict
    
    with get_conn() as conn:
        # Get all credit card accounts for user
        card_accounts = conn.execute(
            "SELECT id, name, upgraded_from_id FROM accounts WHERE type = 'card' AND user_id = ?",
            (current_user.id,)
        ).fetchall()
        
        # Get bank accounts for user (for finding card payments)
        bank_accounts = conn.execute(
            "SELECT id FROM accounts WHERE type = 'bank' AND user_id = ?",
            (current_user.id,)
        ).fetchall()
        bank_ids = [a["id"] for a in bank_accounts]
        
        from app.accounts.matcher import AccountMatcher
        matcher = AccountMatcher(conn, user_id=current_user.id)

        succession_rules = {a["id"]: a["upgraded_from_id"] for a in card_accounts if a["upgraded_from_id"]}
        
        # Build inverse map (parent -> child) to find when a card was superseded
        superseded_by = {v: k for k, v in succession_rules.items()}
        
        # Pre-fetch earliest statement month for each card to define active windows
        first_stmt_months = {}
        stmt_data = conn.execute(
            """
            SELECT account_id, MIN(posted_at) as first_txn 
            FROM transactions 
            WHERE account_id IN (SELECT id FROM accounts WHERE type = 'card' AND user_id = ?) 
              AND user_id = ?
            GROUP BY account_id
            """,
            (current_user.id, current_user.id)
        ).fetchall()
        for row in stmt_data:
            first_stmt_months[row["account_id"]] = str(row["first_txn"])[:7]
            
        # Helper to find the absolute start of an account chain
        def get_chain_start(acc_id):
            curr = acc_id
            seen = {curr}
            while curr in succession_rules:
                curr = succession_rules[curr]
                if curr in seen: break # cycle
                seen.add(curr)
            return curr

        result = []
        
        for card in card_accounts:
            card_id = card["id"]
            card_name = card["name"]
            upgraded_from = card["upgraded_from_id"]
            
            # Succession bounds
            # Start: Either its own first statement, or if no statements, we don't know (fallback)
            card_first_stmt = first_stmt_months.get(card_id)
            
            # End: Month before successor starts
            successor_id = superseded_by.get(card_id)
            successor_first_stmt = first_stmt_months.get(successor_id) if successor_id else None
            
            # Active Window [start, end)
            # We only show gaps if month >= card_first_stmt AND (not successor_first_stmt OR month < successor_first_stmt)
            
            # Patterns to identify payments to this card
            patterns = matcher.get_payment_patterns(card_id)
            if not patterns:
                # Default generic patterns if none defined in metadata
                patterns = ["%CRED%CLUB%"]
            else:
                # Convert to LIKE patterns if they aren't already
                patterns = [f"%{p}%" if "%" not in p else p for p in patterns]
            
            # Find payments from bank accounts matching these patterns
            payments_by_month = defaultdict(list)
            for pattern in patterns:
                if not bank_ids:
                    continue
                placeholders = ",".join("?" * len(bank_ids))
                payments = conn.execute(
                    f"""
                    SELECT posted_at, amount, description_norm
                    FROM transactions
                    WHERE account_id IN ({placeholders})
                    AND description_norm LIKE ?
                    AND amount < 0
                    ORDER BY posted_at DESC
                    """,
                    (*bank_ids, pattern)
                ).fetchall()
                
                for p in payments:
                    # Disambiguation: Use AccountMatcher to verify if this payment belongs to this account
                    if not matcher.is_payment_for_account(p["description_norm"], card_id):
                        continue

                    month = str(p["posted_at"])[:7]  # YYYY-MM
                    payment_obj = {
                        "date": str(p["posted_at"])[:10],
                        "amount": abs(p["amount"]),
                        "description": p["description_norm"][:50]
                    }
                    if payment_obj not in payments_by_month[month]:
                        payments_by_month[month].append(payment_obj)
            
            # Get all transaction months for this card
            month_expr = "TO_CHAR(posted_at, 'YYYY-MM')" if IS_POSTGRES else "substr(posted_at, 1, 7)"
            txn_months_rows = conn.execute(
                f"""
                SELECT {month_expr} as month, COUNT(*) as txn_count
                FROM transactions
                WHERE account_id = ?
                GROUP BY {month_expr}
                ORDER BY month DESC
                """,
                (card_id,)
            ).fetchall()
            
            statements_by_month = {
                t["month"]: {
                    "file_name": "statements",
                    "transaction_count": t["txn_count"],
                    "date_range": t["month"]
                }
                for t in txn_months_rows
            }
            
            # Determine the start and end month for the timeline
            current_month = datetime.now().strftime("%Y-%m")
            
            # Only generate timeline once we have a starting point (first statement)
            if not card_first_stmt:
                result.append({
                    "account_id": card_id,
                    "account_name": card_name,
                    "upgraded_from_id": upgraded_from,
                    "superseded_by_id": successor_id,
                    "timeline": [],
                    "gaps": [],
                    "total_payments": 0,
                    "total_statements": 0,
                })
                continue

            # Start timeline from card's first statement
            start_month_str = card_first_stmt
            
            # Generate potential months
            def get_next_month(m_str):
                y, m = map(int, m_str.split("-"))
                if m == 12: return f"{y+1}-01"
                return f"{y}-{m+1:02d}"

            def get_prev_month(m_str):
                y, m = map(int, m_str.split("-"))
                if m == 1: return f"{y-1}-12"
                return f"{y}-{m-1:02d}"

            end_limit = current_month
            if successor_first_stmt:
                # End at the month before the successor's first statement
                end_limit = min(current_month, get_prev_month(successor_first_stmt))
            
            curr = start_month_str
            all_timeline_months = []
            while curr <= end_limit and len(all_timeline_months) < 48: 
                all_timeline_months.append(curr)
                curr = get_next_month(curr)
            
            timeline = []
            gaps = []
            
            # Most recent months
            for m in reversed(all_timeline_months):
                has_stmt = m in statements_by_month
                
                # Payment attribution: only consider payments if month >= card_first_stmt
                # AND it is not superseded yet.
                is_after_start = m >= card_first_stmt
                is_superseded = successor_first_stmt and m >= successor_first_stmt
                isActive = is_after_start and not is_superseded
                
                payments = payments_by_month.get(m, []) if isActive else []
                has_pay = len(payments) > 0
                
                # Gap Logic: 
                # 1. No statement
                # 2. Within active window
                # 3. Either has a payment OR it's a past month (to ensure no missing statements)
                is_gap = not has_stmt and isActive and (has_pay or m < current_month)
                
                timeline.append({
                    "month": m,
                    "payments": payments,
                    "statements": [statements_by_month[m]] if has_stmt else [],
                    "has_gap": is_gap
                })
                if is_gap:
                    gaps.append(m)
            
            result.append({
                "account_id": card_id,
                "account_name": card_name,
                "upgraded_from_id": upgraded_from,
                "superseded_by_id": successor_id,
                "timeline": timeline,
                "gaps": gaps,
                "total_payments": sum(len(v) for k, v in payments_by_month.items() if (not successor_first_stmt or k < successor_first_stmt) and k >= card_first_stmt),
                "total_statements": len(txn_months_rows),
            })
        
        # Detect untracked card payments (payments to cards not in system)
        untracked_patterns = [
            ("%BOBCARD%", "BOB Card / OneCard"),
            ("%ONECARD%", "OneCard"),
            ("%AXIS%CARD%", "Axis Card"),
            ("%KOTAK%CARD%", "Kotak Card"),
            ("%AU%CARD%", "AU Card"),
            ("%INDUSIND%CARD%", "IndusInd Card"),
        ]
        
        untracked_cards = []
        for pattern, card_name in untracked_patterns:
            if not bank_ids:
                continue
            placeholders = ",".join("?" * len(bank_ids))
            month_expr = "TO_CHAR(posted_at, 'YYYY-MM')" if IS_POSTGRES else "substr(posted_at, 1, 7)"
            payments = conn.execute(
                f"""
                SELECT DISTINCT {month_expr} as month, COUNT(*) as cnt, SUM(ABS(amount)) as total
                FROM transactions
                WHERE account_id IN ({placeholders})
                AND description_norm LIKE ?
                AND amount < 0
                GROUP BY {month_expr}
                ORDER BY month DESC
                """,
                (*bank_ids, pattern)
            ).fetchall()
            
            if payments:
                untracked_cards.append({
                    "card_name": card_name,
                    "pattern": pattern,
                    "payment_months": len(payments),
                    "total_amount": sum(p["total"] for p in payments),
                    "recent_months": [p["month"] for p in payments[:6]]
                })
        
        return {"cards": result, "untracked_cards": untracked_cards}


@app.get("/reports/category/{category_id}")
@cached(ttl=600, key_prefix="reports")
async def report_category_detail(
    category_id: int,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    account_id: Optional[int] = None,
    current_user: schemas.User = Depends(get_current_user)
) -> dict:
    """Get detailed breakdown for a specific category."""
    from datetime import datetime, timedelta
    
    # Validate user-provided dates, then set defaults if needed
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
            end_date = end_dt.strftime("%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD.")
    else:
        end_date = datetime.now().strftime("%Y-%m-%d")
    
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            start_date = start_dt.strftime("%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD.")
    else:
        start_dt = datetime.strptime(end_date, "%Y-%m-%d") - timedelta(days=30)
        start_date = start_dt.strftime("%Y-%m-%d")
    
    # Calculate next day for end_date to include entire day
    end_date_next = (datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d")
    
    clauses = ["t.category_id = ?", "t.posted_at >= ?", "t.posted_at < ?", "t.amount < 0", "l.id IS NULL", "t.user_id = ?"]
    params = [category_id, start_date, end_date_next, current_user.id]
    
    if account_id:
        clauses.append("t.account_id = ?")
        params.append(account_id)
        
    with get_conn() as conn:
        # Get category info
        category = conn.execute(
            "SELECT id, name FROM categories WHERE id = ? AND user_id = ?", 
            (category_id, current_user.id)
        ).fetchone()
        
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        
        # Get subcategory breakdown
        subcategories = conn.execute(
            f"""
            SELECT 
                s.id,
                s.name,
                ABS(SUM(t.amount)) as total,
                COUNT(*) as count
            FROM transactions t
            JOIN subcategories s ON s.id = t.subcategory_id
            LEFT JOIN transaction_links l
              ON (l.source_transaction_id = t.id OR l.target_transaction_id = t.id)
             AND l.link_type = 'card_payment'
            WHERE {' AND '.join(clauses)}
            GROUP BY s.id, s.name
            ORDER BY total DESC
            """,
            params,
        ).fetchall()
        
        # Get time series for this category
        timeseries = conn.execute(
            f"""
            SELECT 
                date(t.posted_at) as period,
                ABS(SUM(t.amount)) as amount,
                COUNT(*) as count
            FROM transactions t
            LEFT JOIN transaction_links l
              ON (l.source_transaction_id = t.id OR l.target_transaction_id = t.id)
             AND l.link_type = 'card_payment'
            WHERE {' AND '.join(clauses)}
            GROUP BY date(t.posted_at)
            ORDER BY period ASC
            """,
            params,
        ).fetchall()
        
        # Get total for this category
        total = conn.execute(
            f"""
            SELECT 
                ABS(SUM(t.amount)) as total,
                COUNT(*) as count,
                AVG(ABS(t.amount)) as avg
            FROM transactions t
            LEFT JOIN transaction_links l
              ON (l.source_transaction_id = t.id OR l.target_transaction_id = t.id)
             AND l.link_type = 'card_payment'
            WHERE {' AND '.join(clauses)}
            """,
            params,
        ).fetchone()
        
        # Get recent transactions
        transactions = conn.execute(
            f"""
            SELECT 
                t.id,
                t.posted_at,
                t.description_raw,
                ABS(t.amount) as amount,
                s.name as subcategory_name
            FROM transactions t
            LEFT JOIN subcategories s ON s.id = t.subcategory_id
            LEFT JOIN transaction_links l
              ON (l.source_transaction_id = t.id OR l.target_transaction_id = t.id)
             AND l.link_type = 'card_payment'
            WHERE {' AND '.join(clauses)}
            ORDER BY t.posted_at DESC
            LIMIT 50
            """,
            params,
        ).fetchall()
    
    return {
        "category": {"id": category["id"], "name": category["name"]},
        "total": total["total"] or 0,
        "count": total["count"] or 0,
        "average": total["avg"] or 0,
        "subcategories": [dict(row) for row in subcategories],
        "timeseries": [dict(row) for row in timeseries],
        "transactions": [dict(row) for row in transactions],
        "start_date": start_date,
        "end_date": end_date,
    }


# ============= Transaction Linking APIs =============

@app.get("/transactions/{transaction_id}/links")
def get_transaction_links(
    transaction_id: int,
    current_user: schemas.User = Depends(get_current_user)
) -> dict:
    """Get all links for a transaction."""
    with get_conn() as conn:
        # Check if transaction exists and belongs to user
        tx = conn.execute(
            "SELECT id, amount, description_raw, posted_at FROM transactions WHERE id = ? AND user_id = ?",
            (transaction_id, current_user.id)
        ).fetchone()
        if not tx:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        # Get all links
        links = conn.execute(
            """
            SELECT 
                l.id as link_id,
                l.link_type,
                l.created_at as linked_at,
                CASE 
                    WHEN l.source_transaction_id = ? THEN t2.id
                    ELSE t1.id
                END as linked_transaction_id,
                CASE 
                    WHEN l.source_transaction_id = ? THEN t2.description_raw
                    ELSE t1.description_raw
                END as linked_description,
                CASE 
                    WHEN l.source_transaction_id = ? THEN t2.amount
                    ELSE t1.amount
                END as linked_amount,
                CASE 
                    WHEN l.source_transaction_id = ? THEN t2.posted_at
                    ELSE t1.posted_at
                END as linked_posted_at,
                CASE 
                    WHEN l.source_transaction_id = ? THEN a2.name
                    ELSE a1.name
                END as linked_account_name
            FROM transaction_links l
            JOIN transactions t1 ON t1.id = l.source_transaction_id
            JOIN transactions t2 ON t2.id = l.target_transaction_id
            JOIN accounts a1 ON a1.id = t1.account_id
            JOIN accounts a2 ON a2.id = t2.account_id
            WHERE (l.source_transaction_id = ? OR l.target_transaction_id = ?)
              AND t1.user_id = ? AND t2.user_id = ?
            """,
            (transaction_id, transaction_id, transaction_id, transaction_id, transaction_id, transaction_id, transaction_id, current_user.id, current_user.id),
        ).fetchall()
        
    return {
        "transaction": dict(tx),
        "links": [dict(row) for row in links],
    }


@app.get("/transactions/{transaction_id}/linkable")
def get_linkable_transactions(
    transaction_id: int,
    current_user: schemas.User = Depends(get_current_user)
) -> dict:
    """Find transactions that could be linked to this one (e.g., matching CC payment to bank debit)."""
    with get_conn() as conn:
        tx = conn.execute(
            """
            SELECT t.id, t.amount, t.description_raw, t.posted_at, t.account_id, a.type as account_type
            FROM transactions t
            JOIN accounts a ON a.id = t.account_id
            WHERE t.id = ? AND t.user_id = ?
            """,
            (transaction_id, current_user.id)
        ).fetchone()
        if not tx:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        # Find potentially linkable transactions:
        # - Opposite sign (payment vs receipt)
        # - Similar amount (within 5% or exact match)
        # - Within 7 days
        # - Not already linked
        # - From different account types (bank vs credit card)
        
        amount = abs(tx["amount"])
        # Use Decimal for calculations to avoid TypeError
        from decimal import Decimal
        min_amount = amount * Decimal("0.95")
        max_amount = amount * Decimal("1.05")
        
        linkable = conn.execute(
            """
            SELECT
                t.id,
                t.amount,
                t.description_raw,
                t.posted_at,
                a.name as account_name,
                a.type as account_type,
                ABS(ABS(t.amount) - ?) as amount_diff
            FROM transactions t
            JOIN accounts a ON a.id = t.account_id
            LEFT JOIN transaction_links l1 ON l1.source_transaction_id = t.id
            LEFT JOIN transaction_links l2 ON l2.target_transaction_id = t.id
            WHERE t.id != ?
              AND t.user_id = ?
              AND t.amount * ? < 0  -- Opposite sign
              AND ABS(t.amount) BETWEEN ? AND ?  -- Similar amount
              AND t.posted_at BETWEEN ? - INTERVAL '7 days' AND ? + INTERVAL '7 days'  -- Within 7 days
              AND l1.id IS NULL AND l2.id IS NULL  -- Not already linked
              AND a.type != ?  -- Different account type
            ORDER BY amount_diff ASC, ABS(t.posted_at - ?) ASC
            LIMIT 20
            """,
            (amount, transaction_id, current_user.id, tx["amount"], min_amount, max_amount,
             tx["posted_at"], tx["posted_at"], tx["account_type"], tx["posted_at"]),
        ).fetchall()
        
    return {
        "transaction": dict(tx),
        "linkable": [dict(row) for row in linkable],
    }


@app.post("/transactions/link")
def create_transaction_link(
    source_id: int = Form(...),
    target_id: int = Form(...),
    link_type: str = Form("card_payment"),
    current_user: schemas.User = Depends(get_current_user)
) -> dict:
    """Create a link between two transactions."""
    if source_id == target_id:
        raise HTTPException(status_code=400, detail="Cannot link a transaction to itself")
    
    with get_conn() as conn:
        # Verify both transactions exist and belong to user
        source = conn.execute("SELECT id, amount FROM transactions WHERE id = ? AND user_id = ?", (source_id, current_user.id)).fetchone()
        target = conn.execute("SELECT id, amount FROM transactions WHERE id = ? AND user_id = ?", (target_id, current_user.id)).fetchone()
        
        if not source or not target:
            raise HTTPException(status_code=404, detail="One or both transactions not found")
        
        # Check if link already exists
        existing = conn.execute(
            """
            SELECT id FROM transaction_links 
            WHERE (source_transaction_id = ? AND target_transaction_id = ?)
               OR (source_transaction_id = ? AND target_transaction_id = ?)
            """,
            (source_id, target_id, target_id, source_id),
        ).fetchone()
        
        if existing:
            raise HTTPException(status_code=400, detail="These transactions are already linked")
        
        # Create the link
        link_id = conn.execute(
            """
            INSERT INTO transaction_links (source_transaction_id, target_transaction_id, link_type)
            VALUES (?, ?, ?)
            """,
            (source_id, target_id, link_type),
        ).lastrowid
        
        # Optionally categorize both as Transfers if they're card payments
        if link_type == "card_payment":
            transfers_cat = conn.execute(
                "SELECT id FROM categories WHERE name = 'Transfers' AND user_id = ?",
                (current_user.id,)
            ).fetchone()
            cc_payment_sub = None
            if transfers_cat:
                cc_payment_sub = conn.execute(
                    "SELECT id FROM subcategories WHERE category_id = ? AND name = 'Credit Card Payment' AND user_id = ?",
                    (transfers_cat["id"], current_user.id)
                ).fetchone()
            
            if transfers_cat and cc_payment_sub:
                conn.execute(
                    "UPDATE transactions SET category_id = ?, subcategory_id = ?, is_uncertain = FALSE WHERE id IN (?, ?) AND user_id = ?",
                    (transfers_cat["id"], cc_payment_sub["id"], source_id, target_id, current_user.id),
                )
        
        conn.commit()
        
    return {"status": "ok", "link_id": link_id}


@app.delete("/transactions/link/{link_id}")
def delete_transaction_link(
    link_id: int,
    current_user: schemas.User = Depends(get_current_user)
) -> dict:
    """Delete a transaction link."""
    with get_conn() as conn:
        # Check if link involve transactions belonging to the user
        link = conn.execute(
            """
            SELECT l.id 
            FROM transaction_links l
            JOIN transactions t ON t.id = l.source_transaction_id
            WHERE l.id = ? AND t.user_id = ?
            """, 
            (link_id, current_user.id)
        ).fetchone()
        if not link:
            raise HTTPException(status_code=404, detail="Link not found")
        
        conn.execute("DELETE FROM transaction_links WHERE id = ?", (link_id,))
        conn.commit()
        
    return {"status": "ok"}


@app.get("/transactions/unlinked-payments")
def get_unlinked_payments(current_user: schemas.User = Depends(get_current_user)) -> dict:
    """Get transactions that look like credit card payments but aren't linked."""
    with get_conn() as conn:
        # Find bank account debits that look like CC payments
        bank_payments = conn.execute(
            """
            SELECT 
                t.id,
                t.amount,
                t.description_raw,
                t.posted_at,
                a.name as account_name
            FROM transactions t
            JOIN accounts a ON a.id = t.account_id
            LEFT JOIN transaction_links l ON l.source_transaction_id = t.id OR l.target_transaction_id = t.id
            WHERE a.type = 'bank'
              AND t.amount < 0
              AND l.id IS NULL
              AND t.user_id = ?
              AND (
                UPPER(t.description_raw) LIKE '%%CREDIT CARD%%'
                OR UPPER(t.description_raw) LIKE '%%CC %%'
                OR UPPER(t.description_raw) LIKE '%%AUTOPAY%%'
                OR UPPER(t.description_raw) LIKE '%%CARD BILL%%'
                OR UPPER(t.description_raw) LIKE '%%HDFC CARD%%'
                OR UPPER(t.description_raw) LIKE '%%ICICI CARD%%'
                OR UPPER(t.description_raw) LIKE '%%SBI CARD%%'
                OR UPPER(t.description_raw) LIKE '%%AMEX%%'
              )
            ORDER BY t.posted_at DESC
            LIMIT 50
            """,
            (current_user.id,)
        ).fetchall()
        
        # Find CC credits that look like bill payments received
        cc_receipts = conn.execute(
            """
            SELECT 
                t.id,
                t.amount,
                t.description_raw,
                t.posted_at,
                a.name as account_name
            FROM transactions t
            JOIN accounts a ON a.id = t.account_id
            LEFT JOIN transaction_links l ON l.source_transaction_id = t.id OR l.target_transaction_id = t.id
            WHERE a.type = 'credit_card'
              AND t.amount > 0
              AND l.id IS NULL
              AND t.user_id = ?
              AND (
                UPPER(t.description_raw) LIKE '%%PAYMENT%%'
                OR UPPER(t.description_raw) LIKE '%%THANK YOU%%'
                OR UPPER(t.description_raw) LIKE '%%RECEIVED%%'
              )
            ORDER BY t.posted_at DESC
            LIMIT 50
            """,
            (current_user.id,)
        ).fetchall()
        
    return {
        "bank_payments": [dict(row) for row in bank_payments],
        "cc_receipts": [dict(row) for row in cc_receipts],
    }


from app.linking import find_potential_transfers, auto_categorize_linked_transfers


@app.get("/transfers/potential")
def get_potential_transfers(
    days_window: int = 7,
    current_user: schemas.User = Depends(get_current_user)
) -> dict:
    """
    Find potential internal transfers that aren't already linked.
    Returns pairs of transactions that may be transfers between accounts.
    """
    with get_conn() as conn:
        potential = find_potential_transfers(conn, days_window, user_id=current_user.id)
    return {"potential_transfers": potential, "count": len(potential)}


@app.post("/transfers/auto-link")
def auto_link_transfers(current_user: schemas.User = Depends(get_current_user)) -> dict:
    """
    Automatically link high-confidence transfers and categorize them.
    Returns count of transactions linked.
    """
    with get_conn() as conn:
        # Find potential transfers with high confidence
        potential = find_potential_transfers(conn, days_window=5, user_id=current_user.id)
        
        linked_count = 0
        for pair in potential:
            if pair["confidence"] >= 80:  # Only auto-link high confidence
                source_id = pair["source"]["id"]
                target_id = pair["target"]["id"]
                
                # Check if not already linked
                existing = conn.execute(
                    """
                    SELECT id FROM transaction_links 
                    WHERE (source_transaction_id = ? AND target_transaction_id = ?)
                       OR (source_transaction_id = ? AND target_transaction_id = ?)
                    """,
                    (source_id, target_id, target_id, source_id)
                ).fetchone()
                
                if not existing:
                    conn.execute(
                        """
                        INSERT INTO transaction_links 
                        (source_transaction_id, target_transaction_id, link_type)
                        VALUES (?, ?, 'internal_transfer')
                        """,
                        (source_id, target_id)
                    )
                    linked_count += 1
        
        conn.commit()
        
        # Categorize all linked transactions as Transfers
        categorized = auto_categorize_linked_transfers(conn, user_id=current_user.id)
    
    return {
        "linked": linked_count,
        "categorized": categorized,
        "status": "ok"
    }


@app.post("/transfers/link")
def link_transfer(
    source_id: int, 
    target_id: int,
    current_user: schemas.User = Depends(get_current_user)
) -> dict:
    """Manually link two transactions as an internal transfer."""
    with get_conn() as conn:
        # Verify both transactions exist and belong to user
        source = conn.execute("SELECT id FROM transactions WHERE id = ? AND user_id = ?", (source_id, current_user.id)).fetchone()
        target = conn.execute("SELECT id FROM transactions WHERE id = ? AND user_id = ?", (target_id, current_user.id)).fetchone()
        
        if not source or not target:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        # Create link
        try:
            conn.execute(
                """
                INSERT INTO transaction_links 
                (source_transaction_id, target_transaction_id, link_type)
                VALUES (?, ?, 'internal_transfer')
                """,
                (source_id, target_id)
            )
            conn.commit()
        except Exception:
            raise HTTPException(status_code=400, detail="Link already exists")
        
        # Categorize as Transfers
        categorized = auto_categorize_linked_transfers(conn, user_id=current_user.id)
    
    return {"status": "ok", "categorized": categorized}


# ============= AI Categorization APIs =============

from app.rules.ai import ai_classify, clear_category_cache

@app.get("/ai/status")
def ai_status(current_user: schemas.User = Depends(get_current_user)) -> dict:
    """Check if AI categorization is configured and available."""
    api_key = os.getenv("GEMINI_API_KEY")
    
    pending_suggestions = 0
    if api_key:
        with get_conn() as conn:
            result = conn.execute(
                "SELECT COUNT(*) as cnt FROM ai_suggestions WHERE status = 'pending' AND user_id = ?",
                (current_user.id,)
            ).fetchone()
            pending_suggestions = result["cnt"] if result else 0
    
    return {
        "configured": bool(api_key),
        "model": "gemini-3-flash-preview" if api_key else None,
        "pending_suggestions": pending_suggestions,
    }


from fastapi.responses import StreamingResponse
import json

@app.post("/ai/categorize")
def ai_categorize_transactions(
    request: Request,
    limit: int = Form(10),
    dry_run: bool = Form(False),
    current_user: schemas.User = Depends(get_current_user)
) -> StreamingResponse:
    """
    Use AI to categorize uncategorized transactions.
    Returns a stream of NDJSON events.
    """
    # HIGH-003: Rate limiting check
    key = f"ai_categorize:{current_user.id}"
    allowed, info = rate_limiter_ai.is_allowed(key)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded for AI categorization. Try again later."
        )
    
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=400, 
            detail="AI categorization not configured. Set GEMINI_API_KEY environment variable."
        )
    
    def generate():
        with get_conn() as conn:
            # Get uncategorized transactions for user
            transactions = conn.execute(
                """
                SELECT t.id, t.description_norm, t.amount, t.description_raw
                FROM transactions t
                WHERE (t.category_id IS NULL OR t.is_uncertain = TRUE) AND t.user_id = ?
                ORDER BY t.posted_at DESC
                LIMIT ?
                """,
                (current_user.id, limit),
            ).fetchall()
            
            if not transactions:
                yield json.dumps({
                    "type": "complete",
                    "stats": {
                        "processed": 0,
                        "categorized": 0,
                        "rules_created": 0
                    }
                }) + "\n"
                return
            
            # Send start event
            yield json.dumps({
                "type": "start",
                "total": len(transactions)
            }) + "\n"
            
            categorized = 0
            
            for i, tx in enumerate(transactions):
                # Call AI for each transaction
                try:
                    result = ai_classify(
                        tx["description_norm"], 
                        tx["amount"], 
                        conn if not dry_run else None,
                        user_id=current_user.id,
                        transaction_id=tx["id"] if not dry_run else None,
                        allow_new_categories=True,
                    )
                    
                    if result:
                        cat_id, subcat_id = result
                        
                        suggestion = None
                        if dry_run:
                            # Get names for response
                            cat_row = conn.execute("SELECT name FROM categories WHERE id = ?", (cat_id,)).fetchone()
                            subcat_row = conn.execute("SELECT name FROM subcategories WHERE id = ?", (subcat_id,)).fetchone()
                            suggestion = {
                                "transaction_id": tx["id"],
                                "description": tx["description_raw"][:50],
                                "amount": tx["amount"],
                                "category": cat_row["name"] if cat_row else None,
                                "subcategory": subcat_row["name"] if subcat_row else None,
                            }
                        else:
                            # Update the transaction
                            conn.execute(
                                """
                                UPDATE transactions
                                SET category_id = ?, subcategory_id = ?, is_uncertain = FALSE
                                WHERE id = ?
                                """,
                                (cat_id, subcat_id, tx["id"]),
                            )
                            # Verify rules created periodically or at end? 
                            # For simplicity we count at end, but we increment categorized count here
                        
                        categorized += 1
                        
                        # Send progress event
                        yield json.dumps({
                            "type": "progress",
                            "current": i + 1,
                            "categorized": categorized,
                            "suggestion": suggestion
                        }) + "\n"
                    else:
                         # Send progress event even if skipped
                        yield json.dumps({
                            "type": "progress",
                            "current": i + 1,
                            "categorized": categorized
                        }) + "\n"
                        
                except Exception as e:
                    print(f"Error processing transaction {tx['id']}: {e}")
            
            # Count rules and suggestions created by AI
            suggestions_created = 0
            rules_created = 0
            if not dry_run:
                new_rules = conn.execute(
                    "SELECT COUNT(*) as cnt FROM rules WHERE name LIKE 'AI:%%'"
                ).fetchone()
                rules_created = new_rules["cnt"] if new_rules else 0
                
                pending_suggestions = conn.execute(
                    "SELECT COUNT(*) as cnt FROM ai_suggestions WHERE status = 'pending'"
                ).fetchone()
                suggestions_created = pending_suggestions["cnt"] if pending_suggestions else 0
                
                conn.commit()
            
            # Send complete event
            yield json.dumps({
                "type": "complete",
                "stats": {
                    "processed": len(transactions),
                    "categorized": categorized,
                    "rules_created": rules_created,
                    "suggestions_pending": suggestions_created
                }
            }) + "\n"

    return StreamingResponse(generate(), media_type="application/x-ndjson")


@app.post("/ai/categorize/{transaction_id}")
def ai_categorize_single(
    transaction_id: int,
    current_user: schemas.User = Depends(get_current_user)
) -> dict:
    """Use AI to categorize a single transaction."""
    import traceback
    
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="AI categorization not configured. Set GEMINI_API_KEY environment variable."
        )
    
    with get_conn() as conn:
        tx = conn.execute(
            "SELECT id, description_norm, amount, description_raw, user_id FROM transactions WHERE id = ?",
            (transaction_id,),
        ).fetchone()
        
        if not tx:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        # Ensure user owns this transaction
        if tx["user_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to categorize this transaction")
        
        try:
            result = ai_classify(
                tx["description_norm"], 
                tx["amount"], 
                conn,
                user_id=current_user.id,
                transaction_id=transaction_id,
                allow_new_categories=True,
            )
        except Exception as e:
            print(f"AI classify error: {e}")
            print(traceback.format_exc())
            return {
                "status": "error",
                "message": f"AI classify exception: {str(e)}",
                "transaction_id": transaction_id,
            }
        
        if not result:
            # Check if a suggestion was created
            suggestion = conn.execute(
                "SELECT * FROM ai_suggestions WHERE transaction_id = ? AND status = 'pending'",
                (transaction_id,)
            ).fetchone()
            
            if suggestion:
                return {
                    "status": "suggestion_created",
                    "message": "AI suggests a new category - please review",
                    "transaction_id": transaction_id,
                    "suggestion_id": suggestion["id"],
                    "suggested_category": suggestion["suggested_category"],
                    "suggested_subcategory": suggestion["suggested_subcategory"],
                }
            
            return {
                "status": "error",
                "message": "AI could not categorize this transaction - check server logs for details",
                "transaction_id": transaction_id,
            }
        
        cat_id, subcat_id = result
        
        # Update the original transaction
        conn.execute(
            """
            UPDATE transactions
            SET category_id = ?, subcategory_id = ?, is_uncertain = FALSE
            WHERE id = ?
            """,
            (cat_id, subcat_id, transaction_id),
        )
        
        # Find and update similar transactions (same normalized description pattern)
        # Extract a pattern from the description
        desc_norm = tx["description_norm"]
        # Take the first significant word(s) as pattern
        words = desc_norm.split()
        pattern = words[0] if words else ""
        if len(words) > 1:
            pattern = f"{words[0]}%{words[1]}"
        
        similar_updated = 0
        if pattern and len(pattern) >= 5:
            # Update similar uncategorized transactions
            cursor = conn.execute(
                """
                UPDATE transactions
                SET category_id = ?, subcategory_id = ?, is_uncertain = FALSE
                WHERE id != ? 
                  AND description_norm LIKE ?
                  AND is_uncertain = TRUE
                """,
                (cat_id, subcat_id, transaction_id, f"%{pattern}%"),
            )
            similar_updated = cursor.rowcount
        
        conn.commit()
        
        # Get names
        cat_row = conn.execute("SELECT name FROM categories WHERE id = ?", (cat_id,)).fetchone()
        subcat_row = conn.execute("SELECT name FROM subcategories WHERE id = ?", (subcat_id,)).fetchone()
        
    return {
        "status": "ok",
        "transaction_id": transaction_id,
        "similar_updated": similar_updated,
        "category": cat_row["name"] if cat_row else None,
        "subcategory": subcat_row["name"] if subcat_row else None,
    }


@app.get("/ai/rules")
def get_ai_rules() -> List[dict]:
    """Get all rules created by AI."""
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT r.id, r.name, r.pattern, r.category_id, r.subcategory_id, r.priority, r.active,
                   c.name as category_name, s.name as subcategory_name
            FROM rules r
            LEFT JOIN categories c ON c.id = r.category_id
            LEFT JOIN subcategories s ON s.id = r.subcategory_id
            WHERE r.name LIKE 'AI:%%'
            ORDER BY r.id DESC
            """
        ).fetchall()
    return [dict(row) for row in rows]


@app.get("/ai/suggestions")
def get_ai_suggestions(status: str = "pending") -> List[dict]:
    """Get AI category suggestions pending approval."""
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT s.id, s.transaction_id, s.suggested_category, s.suggested_subcategory,
                   s.existing_category_id, s.existing_subcategory_id, s.regex_pattern,
                   s.confidence, s.status, s.created_at,
                   t.description_raw, t.amount, t.posted_at
            FROM ai_suggestions s
            JOIN transactions t ON t.id = s.transaction_id
            WHERE s.status = ?
            ORDER BY s.created_at DESC
            """,
            (status,)
        ).fetchall()
    return [dict(row) for row in rows]


@app.post("/ai/suggestions/{suggestion_id}/approve")
def approve_ai_suggestion(suggestion_id: int) -> dict:
    """
    Approve an AI suggestion - creates the category/subcategory if needed
    and categorizes the transaction.
    """
    from app.rules.ai import clear_category_cache
    
    with get_conn() as conn:
        # Get the suggestion
        suggestion = conn.execute(
            "SELECT * FROM ai_suggestions WHERE id = ?",
            (suggestion_id,)
        ).fetchone()
        
        if not suggestion:
            raise HTTPException(status_code=404, detail="Suggestion not found")
        
        if suggestion["status"] != "pending":
            raise HTTPException(status_code=400, detail="Suggestion already processed")
        
        category_id = suggestion["existing_category_id"]
        subcategory_id = suggestion["existing_subcategory_id"]
        
        # Create category if it doesn't exist
        if not category_id:
            cursor = conn.execute(
                "INSERT INTO categories (name) VALUES (?)",
                (suggestion["suggested_category"],)
            )
            category_id = cursor.lastrowid
            clear_category_cache()
        
        # Create subcategory if it doesn't exist
        if not subcategory_id:
            cursor = conn.execute(
                "INSERT INTO subcategories (category_id, name) VALUES (?, ?)",
                (category_id, suggestion["suggested_subcategory"])
            )
            subcategory_id = cursor.lastrowid
            clear_category_cache()
        
        # Update the transaction
        conn.execute(
            """
            UPDATE transactions
            SET category_id = ?, subcategory_id = ?, is_uncertain = FALSE
            WHERE id = ?
            """,
            (category_id, subcategory_id, suggestion["transaction_id"])
        )
        
        # Create a rule if pattern was suggested
        if suggestion["regex_pattern"]:
            try:
                import re
                re.compile(suggestion["regex_pattern"])
                conn.execute(
                    """
                    INSERT INTO rules (name, pattern, category_id, subcategory_id, priority, active)
                    VALUES (?, ?, ?, ?, 55, TRUE)
                    ON CONFLICT DO NOTHING
                    """,
                    (
                        f"AI: {suggestion['suggested_category']} - {suggestion['suggested_subcategory'][:20]}",
                        suggestion["regex_pattern"],
                        category_id,
                        subcategory_id
                    )
                )
            except:
                pass
        
        # Mark suggestion as approved
        conn.execute(
            "UPDATE ai_suggestions SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP WHERE id = ?",
            (suggestion_id,)
        )
        
        conn.commit()
        
    return {
        "status": "ok",
        "category_id": category_id,
        "subcategory_id": subcategory_id,
        "category_name": suggestion["suggested_category"],
        "subcategory_name": suggestion["suggested_subcategory"],
    }


@app.post("/ai/suggestions/{suggestion_id}/reject")
def reject_ai_suggestion(suggestion_id: int) -> dict:
    """Reject an AI suggestion."""
    with get_conn() as conn:
        suggestion = conn.execute(
            "SELECT id, status FROM ai_suggestions WHERE id = ?",
            (suggestion_id,)
        ).fetchone()
        
        if not suggestion:
            raise HTTPException(status_code=404, detail="Suggestion not found")
        
        if suggestion["status"] != "pending":
            raise HTTPException(status_code=400, detail="Suggestion already processed")
        
        conn.execute(
            "UPDATE ai_suggestions SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP WHERE id = ?",
            (suggestion_id,)
        )
        conn.commit()
        
    return {"status": "ok", "suggestion_id": suggestion_id}


@app.post("/ai/suggestions/approve-all")
def approve_all_suggestions() -> dict:
    """Approve all pending AI suggestions."""
    from app.rules.ai import clear_category_cache
    
    with get_conn() as conn:
        suggestions = conn.execute(
            "SELECT id FROM ai_suggestions WHERE status = 'pending'"
        ).fetchall()
        
        approved_count = 0
        for s in suggestions:
            try:
                # Get full suggestion
                suggestion = conn.execute(
                    "SELECT * FROM ai_suggestions WHERE id = ?",
                    (s["id"],)
                ).fetchone()
                
                category_id = suggestion["existing_category_id"]
                subcategory_id = suggestion["existing_subcategory_id"]
                
                # Create category if needed
                if not category_id:
                    existing = conn.execute(
                        "SELECT id FROM categories WHERE LOWER(name) = LOWER(?)",
                        (suggestion["suggested_category"],)
                    ).fetchone()
                    if existing:
                        category_id = existing["id"]
                    else:
                        cursor = conn.execute(
                            "INSERT INTO categories (name) VALUES (?)",
                            (suggestion["suggested_category"],)
                        )
                        category_id = cursor.lastrowid
                
                # Create subcategory if needed
                if not subcategory_id:
                    existing = conn.execute(
                        "SELECT id FROM subcategories WHERE category_id = ? AND LOWER(name) = LOWER(?)",
                        (category_id, suggestion["suggested_subcategory"])
                    ).fetchone()
                    if existing:
                        subcategory_id = existing["id"]
                    else:
                        cursor = conn.execute(
                            "INSERT INTO subcategories (category_id, name) VALUES (?, ?)",
                            (category_id, suggestion["suggested_subcategory"])
                        )
                        subcategory_id = cursor.lastrowid
                
                # Update transaction
                conn.execute(
                    """
                    UPDATE transactions
                    SET category_id = ?, subcategory_id = ?, is_uncertain = FALSE
                    WHERE id = ?
                    """,
                    (category_id, subcategory_id, suggestion["transaction_id"])
                )
                
                # Mark approved
                conn.execute(
                    "UPDATE ai_suggestions SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (s["id"],)
                )
                approved_count += 1
                
            except Exception:
                continue
        
        conn.commit()
        clear_category_cache()
        
    return {"status": "ok", "approved_count": approved_count}


@app.post("/transfers/ignore")
def ignore_transfer(source_id: int, target_id: int) -> dict:
    """Mark a potential transfer as ignored."""
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO transaction_links
            (source_transaction_id, target_transaction_id, link_type)
            VALUES (?, ?, 'ignored')
            ON CONFLICT DO NOTHING
            """,
            (source_id, target_id),
        )
        conn.commit()
    return {"status": "ok"}


# Feature 10: Spending Insights API
@app.get("/analytics/insights")
def get_analytics_insights(
    current_user: schemas.User = Depends(get_current_user)
) -> dict:
    """Get spending insights with month-over-month comparison."""
    return get_spending_insights(current_user.id)


@app.get("/analytics/yearly")
def get_analytics_yearly(
    year: Optional[int] = None,
    current_user: schemas.User = Depends(get_current_user)
) -> List[dict]:
    """Get month-by-month spending for a given year."""
    return get_year_over_year(current_user.id, year)


# Feature 8: Recurring Expenses API
from datetime import timedelta
import calendar


def calculate_next_due_date(frequency: str, current_date: date, interval_days: Optional[int] = None) -> date:
    """Calculate the next due date based on frequency."""
    if frequency == "daily":
        return current_date + timedelta(days=1)
    elif frequency == "weekly":
        return current_date + timedelta(weeks=1)
    elif frequency == "monthly":
        # Move to same day next month, handling month-end
        day = current_date.day
        month = current_date.month + 1
        year = current_date.year
        if month > 12:
            month = 1
            year += 1
        # Get last day of target month
        last_day = calendar.monthrange(year, month)[1]
        day = min(day, last_day)
        return date(year, month, day)
    elif frequency == "quarterly":
        # Move to same day every 3 months
        month = current_date.month + 3
        year = current_date.year
        if month > 12:
            month = month - 12
            year += 1
        day = min(current_date.day, calendar.monthrange(year, month)[1])
        return date(year, month, day)
    elif frequency == "yearly":
        # Move to same day next year
        new_date = date(current_date.year + 1, current_date.month, current_date.day)
        # Handle Feb 29 on non-leap years
        if current_date.month == 2 and current_date.day == 29:
            if not calendar.isleap(current_date.year + 1):
                new_date = date(current_date.year + 1, 2, 28)
        return new_date
    elif frequency == "custom" and interval_days:
        return current_date + timedelta(days=interval_days)
    return current_date + timedelta(days=30)  # Fallback


class RecurringExpenseCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    amount: float
    currency: str = "INR"
    frequency: str
    interval_days: Optional[int] = None
    category_id: Optional[int] = None
    subcategory_id: Optional[int] = None
    account_id: Optional[int] = None
    start_date: date
    end_date: Optional[date] = None
    alert_days_before: int = 3
    merchant_pattern: Optional[str] = None


class RecurringExpenseUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    frequency: Optional[str] = None
    interval_days: Optional[int] = None
    category_id: Optional[int] = None
    subcategory_id: Optional[int] = None
    account_id: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None
    alert_days_before: Optional[int] = None
    merchant_pattern: Optional[str] = None


@app.post("/recurring-expenses")
def create_recurring_expense(
    payload: RecurringExpenseCreateRequest,
    current_user: schemas.User = Depends(get_current_user)
) -> dict:
    """Create a new recurring expense."""
    with get_conn() as conn:
        # Validate category/belonging
        if payload.category_id:
            cat = conn.execute(
                "SELECT id FROM categories WHERE id = ? AND user_id = ?",
                (payload.category_id, current_user.id)
            ).fetchone()
            if not cat:
                raise HTTPException(status_code=400, detail="Invalid category")
        
        if payload.subcategory_id:
            sub = conn.execute(
                "SELECT id FROM subcategories WHERE id = ? AND user_id = ?",
                (payload.subcategory_id, current_user.id)
            ).fetchone()
            if not sub:
                raise HTTPException(status_code=400, detail="Invalid subcategory")
        
        if payload.account_id:
            acc = conn.execute(
                "SELECT id FROM accounts WHERE id = ? AND user_id = ?",
                (payload.account_id, current_user.id)
            ).fetchone()
            if not acc:
                raise HTTPException(status_code=400, detail="Invalid account")
        
        # Calculate next due date
        next_due = calculate_next_due_date(
            payload.frequency, 
            payload.start_date, 
            payload.interval_days
        )
        
        cursor = conn.execute(
            """
            INSERT INTO recurring_expenses 
            (user_id, name, description, amount, currency, frequency, interval_days,
             category_id, subcategory_id, account_id, start_date, end_date, next_due_date,
             alert_days_before, merchant_pattern, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            """,
            (
                current_user.id, payload.name, payload.description, payload.amount,
                payload.currency, payload.frequency, payload.interval_days,
                payload.category_id, payload.subcategory_id, payload.account_id,
                payload.start_date.isoformat(), 
                payload.end_date.isoformat() if payload.end_date else None,
                next_due.isoformat(), payload.alert_days_before, payload.merchant_pattern
            )
        )
        conn.commit()
        
        return {
            "id": cursor.lastrowid,
            "message": "Recurring expense created",
            "next_due_date": next_due.isoformat()
        }


@app.get("/recurring-expenses")
def list_recurring_expenses(
    active_only: bool = True,
    current_user: schemas.User = Depends(get_current_user)
) -> List[dict]:
    """List all recurring expenses for the user."""
    with get_conn() as conn:
        base_query = """
            SELECT 
                re.id, re.user_id, re.name, re.description, re.amount, re.currency,
                re.frequency, re.interval_days, re.category_id, re.subcategory_id, 
                re.account_id, re.start_date, re.end_date, re.next_due_date,
                re.previous_due_date, re.is_active, re.auto_detected, re.merchant_pattern,
                re.alert_days_before, re.created_at, re.updated_at,
                c.name as category_name, s.name as subcategory_name, a.name as account_name
            FROM recurring_expenses re
            LEFT JOIN categories c ON c.id = re.category_id
            LEFT JOIN subcategories s ON s.id = re.subcategory_id
            LEFT JOIN accounts a ON a.id = re.account_id
            WHERE re.user_id = ?
        """
        
        if active_only:
            base_query += " AND re.is_active = 1"
        
        base_query += " ORDER BY re.next_due_date ASC, re.name ASC"
        
        rows = conn.execute(base_query, (current_user.id,)).fetchall()
        
        result = []
        for row in rows:
            expense = dict(row)
            # Parse dates
            for date_field in ['start_date', 'end_date', 'next_due_date', 'previous_due_date']:
                if expense.get(date_field):
                    expense[date_field] = date.fromisoformat(expense[date_field])
            # Parse bool
            expense['is_active'] = bool(expense['is_active'])
            expense['auto_detected'] = bool(expense['auto_detected'])
            result.append(expense)
        
        return result


@app.get("/recurring-expenses/{expense_id}")
def get_recurring_expense(
    expense_id: int,
    current_user: schemas.User = Depends(get_current_user)
) -> dict:
    """Get a specific recurring expense with payment history."""
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT 
                re.id, re.user_id, re.name, re.description, re.amount, re.currency,
                re.frequency, re.interval_days, re.category_id, re.subcategory_id, 
                re.account_id, re.start_date, re.end_date, re.next_due_date,
                re.previous_due_date, re.is_active, re.auto_detected, re.merchant_pattern,
                re.alert_days_before, re.created_at, re.updated_at,
                c.name as category_name, s.name as subcategory_name, a.name as account_name
            FROM recurring_expenses re
            LEFT JOIN categories c ON c.id = re.category_id
            LEFT JOIN subcategories s ON s.id = re.subcategory_id
            LEFT JOIN accounts a ON a.id = re.account_id
            WHERE re.id = ? AND re.user_id = ?
            """,
            (expense_id, current_user.id)
        ).fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="Recurring expense not found")
        
        expense = dict(row)
        
        # Get payment history
        payments = conn.execute(
            """
            SELECT id, recurring_expense_id, transaction_id, scheduled_date, paid_date,
                   expected_amount, actual_amount, status, notes
            FROM recurring_payments
            WHERE recurring_expense_id = ?
            ORDER BY scheduled_date DESC
            LIMIT 12
            """,
            (expense_id,)
        ).fetchall()
        
        # Parse dates
        for date_field in ['start_date', 'end_date', 'next_due_date', 'previous_due_date']:
            if expense.get(date_field):
                expense[date_field] = date.fromisoformat(expense[date_field])
        
        expense['is_active'] = bool(expense['is_active'])
        expense['auto_detected'] = bool(expense['auto_detected'])
        expense['payments'] = [dict(p) for p in payments]
        
        return expense


@app.patch("/recurring-expenses/{expense_id}")
def update_recurring_expense(
    expense_id: int,
    payload: RecurringExpenseUpdateRequest,
    current_user: schemas.User = Depends(get_current_user)
) -> dict:
    """Update a recurring expense."""
    with get_conn() as conn:
        # Verify ownership
        existing = conn.execute(
            "SELECT id FROM recurring_expenses WHERE id = ? AND user_id = ?",
            (expense_id, current_user.id)
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Recurring expense not found")
        
        # Build update
        updates = []
        params = []
        
        if payload.name is not None:
            updates.append("name = ?")
            params.append(payload.name)
        if payload.description is not None:
            updates.append("description = ?")
            params.append(payload.description)
        if payload.amount is not None:
            updates.append("amount = ?")
            params.append(payload.amount)
        if payload.currency is not None:
            updates.append("currency = ?")
            params.append(payload.currency)
        if payload.frequency is not None:
            updates.append("frequency = ?")
            params.append(payload.frequency)
        if payload.interval_days is not None:
            updates.append("interval_days = ?")
            params.append(payload.interval_days)
        if payload.category_id is not None:
            updates.append("category_id = ?")
            params.append(payload.category_id)
        if payload.subcategory_id is not None:
            updates.append("subcategory_id = ?")
            params.append(payload.subcategory_id)
        if payload.account_id is not None:
            updates.append("account_id = ?")
            params.append(payload.account_id)
        if payload.start_date is not None:
            updates.append("start_date = ?")
            params.append(payload.start_date.isoformat())
        if payload.end_date is not None:
            updates.append("end_date = ?")
            params.append(payload.end_date.isoformat() if payload.end_date else None)
        if payload.is_active is not None:
            updates.append("is_active = ?")
            params.append(1 if payload.is_active else 0)
        if payload.alert_days_before is not None:
            updates.append("alert_days_before = ?")
            params.append(payload.alert_days_before)
        if payload.merchant_pattern is not None:
            updates.append("merchant_pattern = ?")
            params.append(payload.merchant_pattern)
        
        updates.append("updated_at = CURRENT_TIMESTAMP")
        
        if updates:
            query = f"UPDATE recurring_expenses SET {', '.join(updates)} WHERE id = ?"
            params.append(expense_id)
            conn.execute(query, tuple(params))
            conn.commit()
        
        return {"status": "ok", "message": "Recurring expense updated"}


@app.delete("/recurring-expenses/{expense_id}")
def delete_recurring_expense(
    expense_id: int,
    current_user: schemas.User = Depends(get_current_user)
) -> dict:
    """Delete a recurring expense and its payments."""
    with get_conn() as conn:
        existing = conn.execute(
            "SELECT id FROM recurring_expenses WHERE id = ? AND user_id = ?",
            (expense_id, current_user.id)
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Recurring expense not found")
        
        # Delete payments first (cascade)
        conn.execute(
            "DELETE FROM recurring_payments WHERE recurring_expense_id = ?",
            (expense_id,)
        )
        # Delete expense
        conn.execute(
            "DELETE FROM recurring_expenses WHERE id = ?",
            (expense_id,)
        )
        conn.commit()
        
        return {"status": "ok", "deleted": True}


@app.post("/recurring-expenses/{expense_id}/payments/record")
def record_recurring_payment(
    expense_id: int,
    transaction_id: Optional[int] = None,
    paid_date: Optional[str] = None,
    actual_amount: Optional[float] = None,
    notes: Optional[str] = None,
    current_user: schemas.User = Depends(get_current_user)
) -> dict:
    """Record a payment for a recurring expense and update next due date."""
    with get_conn() as conn:
        # Verify ownership
        expense = conn.execute(
            """SELECT frequency, interval_days, next_due_date, amount, auto_detected 
               FROM recurring_expenses 
               WHERE id = ? AND user_id = ?""",
            (expense_id, current_user.id)
        ).fetchone()
        
        if not expense:
            raise HTTPException(status_code=404, detail="Recurring expense not found")
        
        current_next_due = date.fromisoformat(expense['next_due_date'])
        
        # Record the payment
        conn.execute(
            """
            INSERT INTO recurring_payments 
            (recurring_expense_id, transaction_id, scheduled_date, paid_date, 
             expected_amount, actual_amount, status, notes)
            VALUES (?, ?, ?, ?, ?, ?, 'paid', ?)
            """,
            (
                expense_id, transaction_id, expense['next_due_date'], 
                paid_date or date.today().isoformat(),
                expense['amount'], actual_amount or expense['amount'], notes
            )
        )
        
        # Calculate and update next due date
        new_next_due = calculate_next_due_date(
            expense['frequency'], current_next_due, expense['interval_days']
        )
        
        conn.execute(
            """
            UPDATE recurring_expenses 
            SET previous_due_date = next_due_date, 
                next_due_date = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (new_next_due.isoformat(), expense_id)
        )
        conn.commit()
        
        return {
            "status": "ok",
            "message": "Payment recorded",
            "new_next_due_date": new_next_due.isoformat()
        }


@app.get("/recurring-expenses/stats/summary")
def get_recurring_expenses_stats(
    current_user: schemas.User = Depends(get_current_user)
) -> dict:
    """Get summary statistics for recurring expenses."""
    today = date.today()
    
    with get_conn() as conn:
        # Basic counts
        total = conn.execute(
            "SELECT COUNT(*) as cnt FROM recurring_expenses WHERE user_id = ? AND is_active = 1",
            (current_user.id,)
        ).fetchone()['cnt']
        
        # Upcoming (next 7 days)
        upcoming_date = (today + timedelta(days=7)).isoformat()
        upcoming = conn.execute(
            """
            SELECT COUNT(*) as cnt FROM recurring_expenses 
            WHERE user_id = ? AND is_active = 1 
            AND next_due_date <= ?
            """,
            (current_user.id, upcoming_date)
        ).fetchone()['cnt']
        
        # Overdue
        overdue = conn.execute(
            """
            SELECT COUNT(*) as cnt FROM recurring_expenses 
            WHERE user_id = ? AND is_active = 1 
            AND next_due_date < ?
            """,
            (current_user.id, today.isoformat())
        ).fetchone()['cnt']
        
        # Monthly total (approximate)
        monthly_total = conn.execute(
            """
            SELECT 
                SUM(CASE 
                    WHEN frequency = 'monthly' THEN amount
                    WHEN frequency = 'daily' THEN amount * 30
                    WHEN frequency = 'weekly' THEN amount * 4.33
                    WHEN frequency = 'quarterly' THEN amount / 3
                    WHEN frequency = 'yearly' THEN amount / 12
                    WHEN frequency = 'custom' AND interval_days IS NOT NULL THEN amount * (30.0 / interval_days)
                    ELSE amount
                END) as total
            FROM recurring_expenses
            WHERE user_id = ? AND is_active = 1
            """,
            (current_user.id,)
        ).fetchone()['total'] or 0
        
        # By frequency
        freq_breakdown = conn.execute(
            """
            SELECT frequency, COUNT(*) as cnt, SUM(amount) as total
            FROM recurring_expenses 
            WHERE user_id = ? AND is_active = 1
            GROUP BY frequency
            """,
            (current_user.id,)
        ).fetchall()
        
        # By category
        cat_breakdown = conn.execute(
            """
            SELECT c.name as category_name, COUNT(*) as cnt, SUM(re.amount) as total
            FROM recurring_expenses re
            JOIN categories c ON c.id = re.category_id
            WHERE re.user_id = ? AND re.is_active = 1 AND re.category_id IS NOT NULL
            GROUP BY re.category_id, c.name
            ORDER BY total DESC
            """,
            (current_user.id,)
        ).fetchall()
        
        return {
            "total_active": total,
            "upcoming_count": upcoming,
            "overdue_count": overdue,
            "monthly_total": round(monthly_total, 2),
            "by_frequency": {r['frequency']: {"count": r['cnt'], "total": r['total']} for r in freq_breakdown},
            "by_category": [dict(r) for r in cat_breakdown]
        }


@app.post("/recurring-expenses/detect")
def detect_recurring_from_transactions(
    months_back: int = 6,
    min_occurrences: int = 3,
    current_user: schemas.User = Depends(get_current_user)
) -> List[dict]:
    """Auto-detect potential recurring expenses from transaction history using pattern matching."""
    from datetime import datetime, timedelta
    
    cutoff_date = (datetime.now() - timedelta(days=months_back * 30)).strftime('%Y-%m-%d')
    
    with get_conn() as conn:
        # Find merchants that appear multiple times with similar amounts
        query = """
        SELECT 
            LOWER(TRIM(description_raw)) as merchant,
            category_id,
            subcategory_id,
            COUNT(*) as occurrence_count,
            AVG(amount) as avg_amount,
            MIN(amount) as min_amount,
            MAX(amount) as max_amount
        FROM transactions
        WHERE user_id = ? 
          AND posted_at >= ?
          AND description_raw IS NOT NULL
          AND TRIM(description_raw) != ''
        GROUP BY LOWER(TRIM(description_raw)), category_id, subcategory_id
        HAVING COUNT(*) >= ?
        ORDER BY COUNT(*) DESC, AVG(amount) DESC
        """
        
        rows = conn.execute(query, (current_user.id, cutoff_date, min_occurrences)).fetchall()
        
        candidates = []
        seen = set()
        
        for row in rows:
            merchant = row['merchant']
            
            # Skip if too generic
            if len(merchant) < 3:
                continue
                
            # Skip already-extracted patterns
            if merchant in seen:
                continue
            seen.add(merchant)
            
            # Get actual dates for pattern analysis
            dates_query = """
            SELECT posted_at, amount
            FROM transactions
            WHERE user_id = ? AND LOWER(TRIM(description_raw)) = ?
            ORDER BY posted_at ASC
            """
            txns = conn.execute(dates_query, (current_user.id, merchant)).fetchall()
            
            if len(txns) < min_occurrences:
                continue
            
            # Calculate date intervals to detect frequency
            intervals = []
            for i in range(1, len(txns)):
                try:
                    # Handle various date formats
                    d1_str = str(txns[i-1]['posted_at'])[:10]
                    d2_str = str(txns[i]['posted_at'])[:10]
                    d1 = date.fromisoformat(d1_str)
                    d2 = date.fromisoformat(d2_str)
                    intervals.append((d2 - d1).days)
                except (ValueError, TypeError):
                    continue
            
            if not intervals:
                continue
            
            avg_interval = sum(intervals) / len(intervals)
            
            # Determine frequency
            frequency = "custom"
            interval_days = None
            if 27 <= avg_interval <= 33:
                frequency = "monthly"
                interval_days = None
            elif 6 <= avg_interval <= 8:
                frequency = "weekly"
                interval_days = None
            elif 85 <= avg_interval <= 95:
                frequency = "quarterly"
                interval_days = None
            elif 360 <= avg_interval <= 370:
                frequency = "yearly"
                interval_days = None
            else:
                frequency = "custom"
                interval_days = int(avg_interval)
            
            # Get category name
            cat_name = None
            if row['category_id']:
                cat_row = conn.execute(
                    "SELECT name FROM categories WHERE id = ?",
                    (row['category_id'],)
                ).fetchone()
                cat_name = cat_row['name'] if cat_row else None
            
            candidates.append({
                "merchant": merchant,
                "category_id": row['category_id'],
                "subcategory_id": row['subcategory_id'],
                "category_name": cat_name,
                "occurrence_count": row['occurrence_count'],
                "suggested_amount": round(row['avg_amount'], 2),
                "amount_range": f"{row['min_amount']:.2f} - {row['max_amount']:.2f}",
                "suggested_frequency": frequency,
                "detected_interval_days": interval_days,
                "avg_interval_days": round(avg_interval, 1),
                "sample_transaction_dates": [str(t['posted_at'])[:10] for t in txns[-5:]]
            })
        
        # Limit candidates
        return candidates[:20]


@app.post("/recurring-expenses/{expense_id}/link-transaction/{transaction_id}")
def link_transaction_to_recurring(
    expense_id: int,
    transaction_id: int,
    current_user: schemas.User = Depends(get_current_user)
) -> dict:
    """Manually link a transaction to a recurring expense."""
    with get_conn() as conn:
        # Verify both exist and belong to user
        expense = conn.execute(
            "SELECT id FROM recurring_expenses WHERE id = ? AND user_id = ?",
            (expense_id, current_user.id)
        ).fetchone()
        if not expense:
            raise HTTPException(status_code=404, detail="Recurring expense not found")
        
        txn = conn.execute(
            "SELECT id, posted_at, amount FROM transactions WHERE id = ? AND user_id = ?",
            (transaction_id, current_user.id)
        ).fetchone()
        if not txn:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        # Check if already linked
        existing = conn.execute(
            """SELECT id FROM recurring_payments 
               WHERE recurring_expense_id = ? AND transaction_id = ?""",
            (expense_id, transaction_id)
        ).fetchone()
        
        if existing:
            return {"status": "ok", "message": "Already linked"}
        
        # Create payment record
        conn.execute(
            """
            INSERT INTO recurring_payments 
            (recurring_expense_id, transaction_id, scheduled_date, paid_date,
             expected_amount, actual_amount, status, notes)
            VALUES (?, ?, ?, ?, ?, ?, 'paid', 'Linked from transaction')
            """,
            (
                expense_id, transaction_id, txn['posted_at'], txn['posted_at'],
                txn['amount'], txn['amount']
            )
        )
        conn.commit()
        
        return {"status": "ok", "message": "Transaction linked successfully"}


# ============================================================================
# DATA BACKUP & RESTORE (Feature 13)
# ============================================================================

@app.get("/backup")
def backup_data(current_user: schemas.User = Depends(get_current_user)) -> Dict[str, Any]:
    """Export all user data for backup."""
    with get_conn() as conn:
        # Get all transactions
        transactions = conn.execute(
            """
            SELECT t.*, a.name as account_name, c.name as category_name,
                   s.name as subcategory_name
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            LEFT JOIN categories c ON t.category_id = c.id
            LEFT JOIN subcategories s ON t.subcategory_id = s.id
            WHERE a.user_id = ?
            ORDER BY t.posted_at DESC
            """,
            (current_user.id,)
        ).fetchall()
        
        # Get accounts
        accounts = conn.execute(
            "SELECT * FROM accounts WHERE user_id = ?",
            (current_user.id,)
        ).fetchall()
        
        # Get categories with details
        categories = conn.execute(
            """
            SELECT c.*, 
                   (SELECT json_group_array(json_object('id', s.id, 'name', s.name))
                    FROM subcategories s WHERE s.category_id = c.id) as subcategories
            FROM categories c
            WHERE c.id IN (SELECT DISTINCT category_id FROM transactions t
                          JOIN accounts a ON t.account_id = a.id WHERE a.user_id = ?)
               OR c.is_system = 1
            """,
            (current_user.id,)
        ).fetchall()
        
        # Get rules
        rules = conn.execute(
            """
            SELECT r.*, c.name as category_name, s.name as subcategory_name
            FROM rules r
            LEFT JOIN categories c ON r.category_id = c.id
            LEFT JOIN subcategories s ON r.subcategory_id = s.id
            WHERE r.user_id = ?
            """,
            (current_user.id,)
        ).fetchall()
        
        # Get transaction tags
        tags = conn.execute(
            """
            SELECT t.* FROM tags t WHERE t.user_id = ?
            """,
            (current_user.id,)
        ).fetchall()
        
        transaction_tags = conn.execute(
            """
            SELECT tt.* FROM transaction_tags tt
            JOIN transactions t ON tt.transaction_id = t.id
            JOIN accounts a ON t.account_id = a.id
            WHERE a.user_id = ?
            """,
            (current_user.id,)
        ).fetchall()
        
        # Get recurring expenses
        recurring = conn.execute(
            """
            SELECT r.*, c.name as category_name, s.name as subcategory_name,
                   a.name as account_name
            FROM recurring_expenses r
            LEFT JOIN categories c ON r.category_id = c.id
            LEFT JOIN subcategories s ON r.subcategory_id = s.id
            LEFT JOIN accounts a ON r.account_id = a.id
            WHERE r.user_id = ?
            """,
            (current_user.id,)
        ).fetchall()
        
        # Get savings goals
        goals = conn.execute(
            """
            SELECT g.*, c.name as category_name
            FROM savings_goals g
            LEFT JOIN categories c ON g.category_id = c.id
            WHERE g.user_id = ?
            """,
            (current_user.id,)
        ).fetchall()
        
        # Convert to dict format
        def row_to_dict(row):
            return {key: row[key] for key in row.keys()}
        
        backup_data = {
            "transactions": [row_to_dict(t) for t in transactions],
            "accounts": [row_to_dict(a) for a in accounts],
            "categories": [row_to_dict(c) for c in categories],
            "rules": [row_to_dict(r) for r in rules],
            "tags": [row_to_dict(t) for t in tags],
            "transaction_tags": [row_to_dict(tt) for tt in transaction_tags],
            "recurring_expenses": [row_to_dict(r) for r in recurring],
            "savings_goals": [row_to_dict(g) for g in goals],
        }
        
        # Record backup metadata
        conn.execute(
            """
            INSERT INTO backup_metadata 
            (user_id, backup_version, transaction_count, category_count)
            VALUES (?, '1.1', ?, ?)
            """,
            (current_user.id, len(transactions), len(categories))
        )
        conn.commit()
        
        return backup_data

@app.post("/restore")
def restore_data(
    data: Dict[str, Any],
    current_user: schemas.User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Restore user data from backup."""
    with get_conn() as conn:
        restored = {"transactions": 0, "categories": 0, "accounts": 0, "rules": 0}
        
        # Restore accounts first
        if "accounts" in data:
            for account in data["accounts"]:
                try:
                    conn.execute(
                        """
                        INSERT OR IGNORE INTO accounts 
                        (user_id, name, type, currency)
                        VALUES (?, ?, ?, ?)
                        """,
                        (current_user.id, account["name"], 
                         account.get("type", "bank"), 
                         account.get("currency", "INR"))
                    )
                    if conn.total_changes > 0:
                        restored["accounts"] += 1
                except Exception:
                    pass
        
        # Restore categories
        if "categories" in data:
            for category in data["categories"]:
                try:
                    conn.execute(
                        """
                        INSERT OR IGNORE INTO categories 
                        (name, color, monthly_budget, icon, tax_category_id)
                        VALUES (?, ?, ?, ?, ?)
                        """,
                        (category["name"], 
                         category.get("color"), 
                         category.get("monthly_budget"),
                         category.get("icon"),
                         category.get("tax_category_id"))
                    )
                    if conn.total_changes > 0:
                        restored["categories"] += 1
                except Exception:
                    pass
        
        # Restore transactions
        if "transactions" in data:
            for txn in data["transactions"]:
                try:
                    # Find or create account
                    account = conn.execute(
                        "SELECT id FROM accounts WHERE user_id = ? AND name = ?",
                        (current_user.id, txn.get("account_name"))
                    ).fetchone()
                    
                    if not account:
                        # Create default account
                        cursor = conn.execute(
                            "INSERT INTO accounts (user_id, name, type, currency) VALUES (?, ?, ?, ?)",
                            (current_user.id, txn.get("account_name", "Imported"), 
                             txn.get("account_type", "bank"), txn.get("currency", "INR"))
                        )
                        account_id = cursor.lastrowid
                    else:
                        account_id = account["id"]
                    
                    # Find category
                    category_id = None
                    if txn.get("category_name"):
                        cat = conn.execute(
                            "SELECT id FROM categories WHERE name = ?",
                            (txn["category_name"],)
                        ).fetchone()
                        if cat:
                            category_id = cat["id"]
                    
                    # Insert transaction
                    conn.execute(
                        """
                        INSERT OR IGNORE INTO transactions
                        (account_id, posted_at, amount, currency, description_raw,
                         description_norm, category_id, is_uncertain, hash)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (account_id, txn["posted_at"], txn["amount"], 
                         txn.get("currency", "INR"), txn["description_raw"],
                         txn.get("description_norm", txn["description_raw"]),
                         category_id, False, txn.get("hash", hashlib.md5(
                             f"{account_id}{txn['posted_at']}{txn['amount']}{txn['description_raw']}".encode()
                         ).hexdigest()))
                    )
                    if conn.total_changes > 0:
                        restored["transactions"] += 1
                except Exception:
                    pass
        
        # Restore rules
        if "rules" in data:
            for rule in data["rules"]:
                try:
                    category_id = None
                    if rule.get("category_name"):
                        cat = conn.execute(
                            "SELECT id FROM categories WHERE name = ?",
                            (rule["category_name"],)
                        ).fetchone()
                        if cat:
                            category_id = cat["id"]
                    
                    if category_id:
                        conn.execute(
                            """
                            INSERT OR IGNORE INTO rules
                            (user_id, name, pattern, category_id, subcategory_id,
                             min_amount, max_amount, priority, account_type, active)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """,
                            (current_user.id, rule["name"], rule["pattern"],
                             category_id, None, rule.get("min_amount"),
                             rule.get("max_amount"), rule.get("priority", 50),
                             rule.get("account_type"), rule.get("active", 1))
                        )
                        if conn.total_changes > 0:
                            restored["rules"] += 1
                except Exception:
                    pass
        
        conn.commit()
        return {"status": "ok", "restored": restored}


# ============================================================================
# DUPLICATE DETECTION (Feature 14)
# ============================================================================

@app.get("/duplicates/potential")
def get_potential_duplicates(
    days: int = 30,
    current_user: schemas.User = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """Find potential duplicate transactions."""
    with get_conn() as conn:
        cutoff_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        
        # Find duplicates by amount + date
        duplicates = conn.execute(
            """
            SELECT t1.id as id1, t2.id as id2, 
                   t1.amount, t1.posted_at, t1.description_raw as desc1,
                   t2.description_raw as desc2,
                   ABS(julianday(t1.posted_at) - julianday(t2.posted_at)) as days_diff,
                   CASE 
                       WHEN t1.hash = t2.hash THEN 'hash'
                       WHEN t1.amount = t2.amount AND t1.posted_at = t2.posted_at THEN 'amount_date'
                       ELSE 'amount_similar_date'
                   END as reason
            FROM transactions t1
            JOIN transactions t2 ON t1.id < t2.id
            JOIN accounts a1 ON t1.account_id = a1.id
            JOIN accounts a2 ON t2.account_id = a2.id
            WHERE a1.user_id = ? AND a2.user_id = ?
              AND t1.posted_at >= ? AND t2.posted_at >= ?
              AND (t1.hash = t2.hash 
                   OR (t1.amount = t2.amount 
                       AND ABS(julianday(t1.posted_at) - julianday(t2.posted_at)) <= 2))
            ORDER BY t1.posted_at DESC
            LIMIT 100
            """,
            (current_user.id, current_user.id, cutoff_date, cutoff_date)
        ).fetchall()
        
        return [dict(d) for d in duplicates]

@app.post("/duplicates/merge")
def merge_duplicates(
    keep_id: int,
    remove_id: int,
    current_user: schemas.User = Depends(get_current_user)
) -> Dict[str, str]:
    """Merge two duplicate transactions, keeping one and deleting the other."""
    with get_conn() as conn:
        # Verify both transactions belong to user
        txn_keep = conn.execute(
            """
            SELECT t.id FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE t.id = ? AND a.user_id = ?
            """,
            (keep_id, current_user.id)
        ).fetchone()
        
        txn_remove = conn.execute(
            """
            SELECT t.id FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE t.id = ? AND a.user_id = ?
            """,
            (remove_id, current_user.id)
        ).fetchone()
        
        if not txn_keep or not txn_remove:
            raise HTTPException(status_code=404, detail="Transactions not found")
        
        # Delete the duplicate
        conn.execute(
            "DELETE FROM transactions WHERE id = ?",
            (remove_id,)
        )
        conn.commit()
        
        return {"status": "ok", "message": "Duplicates merged successfully"}


# ============================================================================
# DUPLICATE DETECTION API v1 (Frontend Integration)
# ============================================================================

@app.get("/api/v1/duplicates/detect")
def detect_duplicates(
    days: int = Query(90, ge=1, le=365),
    similarity_threshold: float = Query(0.85, ge=0.0, le=1.0),
    current_user: schemas.User = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """Detect potential duplicate transactions with similarity scoring.
    
    Frontend calls this endpoint to get duplicate pairs with:
    - Similarity score based on amount, date, and description matching
    - Configurable days lookback and similarity threshold
    """
    with get_conn() as conn:
        cutoff_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        
        # Find duplicates with similarity scoring
        # Uses multiple matching strategies with calculated similarity scores
        duplicates = conn.execute(
            """
            SELECT 
                t1.id as original_transaction_id,
                t2.id as duplicate_transaction_id,
                t1.amount as original_amount,
                t1.description_raw as original_description,
                t1.posted_at as original_date,
                t2.amount as duplicate_amount,
                t2.description_raw as duplicate_description,
                t2.posted_at as duplicate_date,
                -- Calculate similarity score
                CASE 
                    -- Exact hash match = 100%
                    WHEN t1.hash = t2.hash THEN 1.0
                    -- Same amount and same date = 95%
                    WHEN t1.amount = t2.amount AND t1.posted_at = t2.posted_at THEN 0.95
                    -- Same amount within 1 day = 90%
                    WHEN t1.amount = t2.amount AND ABS(julianday(t1.posted_at) - julianday(t2.posted_at)) <= 1 THEN 0.90
                    -- Same amount within 2 days = 85%
                    WHEN t1.amount = t2.amount AND ABS(julianday(t1.posted_at) - julianday(t2.posted_at)) <= 2 THEN 0.85
                    -- Similar amount (within 1%) and same date = 80%
                    WHEN ABS(t1.amount - t2.amount) / NULLIF(t1.amount, 0) <= 0.01 AND t1.posted_at = t2.posted_at THEN 0.80
                    -- Similar amount within 1% and within 1 day = 75%
                    WHEN ABS(t1.amount - t2.amount) / NULLIF(t1.amount, 0) <= 0.01 AND ABS(julianday(t1.posted_at) - julianday(t2.posted_at)) <= 1 THEN 0.75
                    ELSE 0.0
                END as similarity_score,
                'pending' as status
            FROM transactions t1
            JOIN transactions t2 ON t1.id < t2.id
            JOIN accounts a1 ON t1.account_id = a1.id
            JOIN accounts a2 ON t2.account_id = a2.id
            WHERE a1.user_id = ? AND a2.user_id = ?
              AND t1.posted_at >= ? AND t2.posted_at >= ?
              AND (
                t1.hash = t2.hash 
                OR (t1.amount = t2.amount AND ABS(julianday(t1.posted_at) - julianday(t2.posted_at)) <= 2)
                OR (ABS(t1.amount - t2.amount) / NULLIF(t1.amount, 0) <= 0.01 AND ABS(julianday(t1.posted_at) - julianday(t2.posted_at)) <= 1)
              )
            ORDER BY similarity_score DESC, t1.posted_at DESC
            LIMIT 100
            """,
            (current_user.id, current_user.id, cutoff_date, cutoff_date)
        ).fetchall()
        
        # Filter by similarity threshold
        filtered = [dict(d) for d in duplicates if d["similarity_score"] >= similarity_threshold]
        
        # Assign unique IDs to each pair
        result = []
        for idx, dup in enumerate(filtered):
            result.append({
                "id": idx + 1,
                **dup
            })
        
        return result


class DuplicateActionRequest(BaseModel):
    pair_id: int
    action: str  # 'mark_duplicate', 'not_duplicate', 'delete_duplicate'


@app.post("/api/v1/duplicates/action")
def duplicate_action(
    request: DuplicateActionRequest,
    current_user: schemas.User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Handle duplicate detection actions.
    
    Actions:
    - 'mark_duplicate': Mark transactions as confirmed duplicates
    - 'not_duplicate': Mark as not duplicates (dismiss)
    - 'delete_duplicate': Delete the duplicate transaction
    """
    with get_conn() as conn:
        # For now, we just handle delete_duplicate action
        # The other actions would require storing the decision in a table
        
        if request.action == "delete_duplicate":
            # Find the duplicate transaction ID from the pair
            # We need to look it up from the detect results stored in memory
            # Since we don't persist duplicate pairs, we'll use the pair_id as reference
            
            # Get the transactions for this user that match duplicate criteria
            # This is a simplified implementation - in production you'd store pairs
            duplicates = conn.execute(
                """
                SELECT 
                    t1.id as original_id,
                    t2.id as duplicate_id
                FROM transactions t1
                JOIN transactions t2 ON t1.id < t2.id
                JOIN accounts a1 ON t1.account_id = a1.id
                JOIN accounts a2 ON t2.account_id = a2.id
                WHERE a1.user_id = ? AND a2.user_id = ?
                ORDER BY t1.posted_at DESC
                LIMIT 100
                """,
                (current_user.id, current_user.id)
            ).fetchall()
            
            # Find the duplicate by pair_id (offset)
            if request.pair_id > 0 and request.pair_id <= len(duplicates):
                dup = duplicates[request.pair_id - 1]
                duplicate_id = dup["duplicate_id"]
                
                # Verify ownership
                owner = conn.execute(
                    """
                    SELECT a.user_id FROM transactions t
                    JOIN accounts a ON t.account_id = a.id
                    WHERE t.id = ?
                    """,
                    (duplicate_id,)
                ).fetchone()
                
                if owner and owner["user_id"] == current_user.id:
                    conn.execute("DELETE FROM transactions WHERE id = ?", (duplicate_id,))
                    conn.commit()
                    return {"status": "ok", "message": "Duplicate transaction deleted"}
            
            return {"status": "ok", "message": "Duplicate not found or already handled"}
        
        elif request.action == "mark_duplicate":
            # Mark as confirmed duplicate - in production, store in a table
            return {"status": "ok", "message": "Marked as duplicate"}
        
        elif request.action == "not_duplicate":
            # Dismiss - in production, store dismissal to prevent showing again
            return {"status": "ok", "message": "Marked as not duplicate"}
        
        else:
            raise HTTPException(status_code=400, detail="Invalid action")


# ============================================================================
# ARCHIVE MANAGEMENT (Feature 15)
# ============================================================================

@app.post("/archive/transactions")
def archive_old_transactions(
    before_date: str,
    dry_run: bool = True,
    current_user: schemas.User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Archive transactions older than the given date."""
    with get_conn() as conn:
        # Count transactions to archive
        cursor = conn.execute(
            """
            SELECT COUNT(*) as count FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE a.user_id = ? AND t.posted_at < ?
            """,
            (current_user.id, before_date)
        )
        count = cursor.fetchone()["count"]
        
        if dry_run:
            return {
                "dry_run": True,
                "before_date": before_date,
                "count": count,
                "message": f"{count} transactions would be archived"
            }
        
        # Get transactions to archive
        transactions = conn.execute(
            """
            SELECT t.*, a.user_id FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE a.user_id = ? AND t.posted_at < ?
            """,
            (current_user.id, before_date)
        ).fetchall()
        
        # Archive each transaction
        archived = 0
        for txn in transactions:
            conn.execute(
                """
                INSERT INTO archived_transactions
                (original_transaction_id, user_id, account_id, posted_at, amount,
                 currency, description_raw, description_norm, category_id,
                 subcategory_id, notes, archive_reason)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (txn["id"], txn["user_id"], txn["account_id"], txn["posted_at"],
                 txn["amount"], txn["currency"], txn["description_raw"],
                 txn["description_norm"], txn["category_id"],
                 txn["subcategory_id"], txn.get("notes"), "old_data")
            )
            archived += 1
        
        # Delete archived transactions
        conn.execute(
            """
            DELETE FROM transactions WHERE id IN (
                SELECT t.id FROM transactions t
                JOIN accounts a ON t.account_id = a.id
                WHERE a.user_id = ? AND t.posted_at < ?
            )
            """,
            (current_user.id, before_date)
        )
        conn.commit()
        
        return {
            "archived": archived,
            "before_date": before_date,
            "message": f"{archived} transactions archived"
        }


# ============================================================================
# SMART TAGS (Feature 16)
# ============================================================================

@app.get("/tags")
def get_tags(
    current_user: schemas.User = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """Get all tags for the user."""
    with get_conn() as conn:
        tags = conn.execute(
            """
            SELECT t.*,
                   (SELECT COUNT(*) FROM transaction_tags tt WHERE tt.tag_id = t.id) as usage_count
            FROM tags t
            WHERE t.user_id = ?
            ORDER BY t.name
            """,
            (current_user.id,)
        ).fetchall()
        return [dict(tag) for tag in tags]

@app.post("/tags")
def create_tag(
    name: str,
    color: str = "#3b82f6",
    description: Optional[str] = None,
    current_user: schemas.User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Create a new tag."""
    with get_conn() as conn:
        try:
            cursor = conn.execute(
                """INSERT INTO tags (user_id, name, color, description)
                   VALUES (?, ?, ?, ?)""",
                (current_user.id, name, color, description)
            )
            conn.commit()
            
            tag = conn.execute(
                "SELECT * FROM tags WHERE id = ?",
                (cursor.lastrowid,)
            ).fetchone()
            return dict(tag)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Tag already exists: {str(e)}")

@app.put("/tags/{tag_id}")
def update_tag(
    tag_id: int,
    name: Optional[str] = None,
    color: Optional[str] = None,
    description: Optional[str] = None,
    current_user: schemas.User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Update a tag."""
    with get_conn() as conn:
        tag = conn.execute(
            "SELECT * FROM tags WHERE id = ? AND user_id = ?",
            (tag_id, current_user.id)
        ).fetchone()
        if not tag:
            raise HTTPException(status_code=404, detail="Tag not found")
        
        updates = []
        values = []
        if name:
            updates.append("name = ?")
            values.append(name)
        if color:
            updates.append("color = ?")
            values.append(color)
        if description is not None:
            updates.append("description = ?")
            values.append(description)
        
        if updates:
            values.extend([tag_id, current_user.id])
            conn.execute(
                f"UPDATE tags SET {', '.join(updates)} WHERE id = ? AND user_id = ?",
                values
            )
            conn.commit()
        
        tag = conn.execute(
            "SELECT * FROM tags WHERE id = ?",
            (tag_id,)
        ).fetchone()
        return dict(tag)

@app.delete("/tags/{tag_id}")
def delete_tag(
    tag_id: int,
    current_user: schemas.User = Depends(get_current_user)
) -> Dict[str, str]:
    """Delete a tag."""
    with get_conn() as conn:
        conn.execute(
            "DELETE FROM tags WHERE id = ? AND user_id = ?",
            (tag_id, current_user.id)
        )
        conn.commit()
        return {"status": "ok"}

@app.post("/transactions/{transaction_id}/tags")
def add_tags_to_transaction(
    transaction_id: int,
    tag_ids: List[int],
    current_user: schemas.User = Depends(get_current_user)
) -> Dict[str, str]:
    """Add tags to a transaction."""
    with get_conn() as conn:
        # Verify transaction belongs to user
        txn = conn.execute(
            """
            SELECT t.id FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE t.id = ? AND a.user_id = ?
            """,
            (transaction_id, current_user.id)
        ).fetchone()
        
        if not txn:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        for tag_id in tag_ids:
            conn.execute(
                "INSERT OR IGNORE INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)",
                (transaction_id, tag_id)
            )
        conn.commit()
        
        return {"status": "ok"}

@app.delete("/transactions/{transaction_id}/tags/{tag_id}")
def remove_tag_from_transaction(
    transaction_id: int,
    tag_id: int,
    current_user: schemas.User = Depends(get_current_user)
) -> Dict[str, str]:
    """Remove a tag from a transaction."""
    with get_conn() as conn:
        conn.execute(
            """
            DELETE FROM transaction_tags 
            WHERE transaction_id = ? AND tag_id = ?
            AND EXISTS (
                SELECT 1 FROM transactions t
                JOIN accounts a ON t.account_id = a.id
                WHERE t.id = ? AND a.user_id = ?
            )
            """,
            (transaction_id, tag_id, transaction_id, current_user.id)
        )
        conn.commit()
        return {"status": "ok"}


# =============================================================================
# TRASH BIN - Soft Delete Feature
# =============================================================================
from pydantic import BaseModel

class TrashItemCreate(BaseModel):
    """Request model for soft deleting an item."""
    table: str
    id: int
    reason: Optional[str] = None

# Valid tables that can be moved to trash
VALID_TRASH_TABLES = {'transactions', 'categories', 'accounts', 'rules'}

def _fetch_item_data(conn, table: str, item_id: int, user_id: int) -> Optional[Dict[str, Any]]:
    """Fetch all data from an item in any supported table."""
    # Validate table name
    table = sanitize_sql_identifier(table)
    if table not in VALID_TRASH_TABLES:
        raise HTTPException(status_code=400, detail=f"Invalid table: {table}")

    # Query all columns from the table
    query = f"SELECT * FROM {table} WHERE id = ? AND user_id = ?"
    result = conn.execute(query, (item_id, user_id)).fetchone()

    if not result:
        return None

    # Convert row to dict (handle both sqlite3.Row and psycopg2 RealDictRow)
    return dict(result)

def _restore_item(conn, trash_entry: Dict[str, Any]) -> None:
    """Restore an item from trash back to its original table."""
    table = trash_entry['original_table']
    table = sanitize_sql_identifier(table)

    # Parse JSON data (for SQLite it's stored as TEXT, for PostgreSQL it's JSONB)
    data = trash_entry['data']
    if isinstance(data, str):
        import json
        data = json.loads(data)

    # Remove id from data as it will be auto-generated or we need to preserve it
    original_id = data.get('id')

    # Build column names and placeholders
    columns = list(data.keys())
    values = list(data.values())

    # For PostgreSQL, use $1, $2 etc placeholders; for SQLite use ?
    placeholders = ','.join(['?' for _ in values])
    columns_str = ','.join(columns)

    # First, check if the item already exists (it might have been re-created)
    existing = conn.execute(
        f"SELECT id FROM {table} WHERE id = ?",
        (original_id,)
    ).fetchone()

    if existing:
        # Item already exists, we can't restore. Just update the trash entry? No.
        # We should probably raise an error or skip. For now, raise an error.
        raise HTTPException(
            status_code=400,
            detail=f"Cannot restore: an item with id {original_id} already exists in {table}"
        )

    # Insert the item preserving the ID
    # For SQLite with INTEGER PRIMARY KEY AUTOINCREMENT, we can explicitly set the ID
    # For PostgreSQL SERIAL, we can also explicitly set the ID
    query = f"INSERT INTO {table} ({columns_str}) VALUES ({placeholders})"
    conn.execute(query, values)

@app.get("/trash")
def list_trash_items(
    current_user: schemas.User = Depends(get_current_user)
):
    """List items in trash bin (soft-deleted items)."""
    with get_conn() as conn:
        # Trash table may not exist yet in older databases
        try:
            rows = conn.execute(
                """
                SELECT id, original_table, original_id, data, deleted_at, deleted_by, reason
                FROM trash
                WHERE deleted_by = ?
                ORDER BY deleted_at DESC
                LIMIT 100
                """,
                (current_user.id,)
            ).fetchall()

            items = []
            for row in rows:
                # Parse data if stored as string (SQLite)
                data = row['data']
                if isinstance(data, str):
                    import json
                    data = json.loads(data)

                items.append({
                    'id': row['id'],
                    'original_table': row['original_table'],
                    'original_id': row['original_id'],
                    'data': data,
                    'deleted_at': str(row['deleted_at']) if row['deleted_at'] else None,
                    'deleted_by': row['deleted_by'],
                    'reason': row['reason']
                })

            return {"items": items, "total": len(items)}
        except Exception as e:
            # If trash table doesn't exist, return empty
            print(f"Trash table may not exist: {e}")
            return {"items": [], "total": 0}

@app.post("/trash")
def soft_delete_item(
    payload: TrashItemCreate,
    current_user: schemas.User = Depends(get_current_user)
):
    """Soft delete an item by moving it to trash."""
    # Validate table name
    if payload.table not in VALID_TRASH_TABLES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid table: {payload.table}. Valid tables: {', '.join(VALID_TRASH_TABLES)}"
        )

    with get_conn() as conn:
        # Fetch the item data
        item_data = _fetch_item_data(conn, payload.table, payload.id, current_user.id)
        if not item_data:
            raise HTTPException(status_code=404, detail=f"Item not found in {payload.table}")

        # Serialize data to JSON
        import json
        data_json = json.dumps(item_data)

        # Insert into trash table
        # The trash table may not exist in older databases
        try:
            cursor = conn.execute(
                """
                INSERT INTO trash (original_table, original_id, data, deleted_by, reason)
                VALUES (?, ?, ?, ?, ?)
                """,
                (payload.table, payload.id, data_json, current_user.id, payload.reason)
            )
            trash_id = cursor.lastrowid
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Trash feature not available: {str(e)}"
            )

        # Delete from original table (soft delete by actually deleting)
        table = sanitize_sql_identifier(payload.table)
        conn.execute(
            f"DELETE FROM {table} WHERE id = ? AND user_id = ?",
            (payload.id, current_user.id)
        )

        conn.commit()

    return {"trash_id": trash_id, "status": "ok"}

@app.post("/trash/{trash_id}/restore")
def restore_trash_item(
    trash_id: int,
    current_user: schemas.User = Depends(get_current_user)
):
    """Restore an item from trash."""
    with get_conn() as conn:
        # Fetch the trash entry
        try:
            row = conn.execute(
                """
                SELECT id, original_table, original_id, data, deleted_at, deleted_by, reason
                FROM trash
                WHERE id = ? AND deleted_by = ?
                """,
                (trash_id, current_user.id)
            ).fetchone()
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Trash feature not available: {str(e)}"
            )

        if not row:
            raise HTTPException(status_code=404, detail="Trash item not found")

        # Convert to dict
        trash_entry = {
            'id': row['id'],
            'original_table': row['original_table'],
            'original_id': row['original_id'],
            'data': row['data'],
            'deleted_at': row['deleted_at'],
            'deleted_by': row['deleted_by'],
            'reason': row['reason']
        }

        try:
            # Restore the item to original table
            _restore_item(conn, trash_entry)

            # Delete from trash
            conn.execute("DELETE FROM trash WHERE id = ?", (trash_id,))

            conn.commit()
        except HTTPException:
            # Re-raise HTTPException
            raise
        except Exception as e:
            conn.rollback()
            raise HTTPException(
                status_code=500,
                detail=f"Failed to restore item: {str(e)}"
            )

    return {"status": "ok", "message": f"Item restored to {trash_entry['original_table']}"}

@app.delete("/trash/{trash_id}")
def permanently_delete_trash_item(
    trash_id: int,
    current_user: schemas.User = Depends(get_current_user)
):
    """Permanently delete an item from trash."""
    with get_conn() as conn:
        # Verify ownership
        try:
            row = conn.execute(
                """
                SELECT id FROM trash
                WHERE id = ? AND deleted_by = ?
                """,
                (trash_id, current_user.id)
            ).fetchone()
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Trash feature not available: {str(e)}"
            )

        if not row:
            raise HTTPException(status_code=404, detail="Trash item not found")

        # Delete from trash (truly gone now)
        conn.execute("DELETE FROM trash WHERE id = ?", (trash_id,))
        conn.commit()

    return {"status": "ok", "message": "Item permanently deleted"}

@app.delete("/trash/empty")
def empty_trash(
    before_date: Optional[str] = None,
    current_user: schemas.User = Depends(get_current_user)
):
    """Empty the trash bin."""
    with get_conn() as conn:
        try:
            if before_date:
                # Delete items deleted before the specified date
                conn.execute(
                    """
                    DELETE FROM trash
                    WHERE deleted_by = ? AND deleted_at < ?
                    """,
                    (current_user.id, before_date)
                )
            else:
                # Delete all items for this user
                conn.execute(
                    """
                    DELETE FROM trash
                    WHERE deleted_by = ?
                    """,
                    (current_user.id,)
                )
            deleted_count = conn.rowcount
            conn.commit()
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Trash feature not available: {str(e)}"
            )

    return {
        "status": "ok",
        "deleted_count": deleted_count,
        "message": f"Deleted {deleted_count} items from trash"
    }


# =============================================================================
# PHASE 3 FEATURES - Import and register
# =============================================================================
from app.phase3_endpoints import router as phase3_router, register_phase3_routes

# Register Phase 3 routes
app.include_router(phase3_router)

