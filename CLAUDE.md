# Project Conventions & Gotchas

## Database Connection Wrappers

### Context Manager Protocol is Required
When creating custom database connection wrappers (like `PostgresConnectionWrapper` for psycopg2), **always implement the full context manager protocol**:

```python
def __enter__(self):
    """Context manager entry - return self."""
    return self

def __exit__(self, exc_type, exc_val, exc_tb):
    """Context manager exit - commit on success, rollback on error."""
    if exc_type is None:
        try:
            self.commit()
        except Exception:
            self.rollback()
    else:
        self.rollback()
    self.close()
    return False
```

Without these methods, the wrapper will fail when used with `with get_conn() as conn:` pattern.

### SQLite vs PostgreSQL Differences
- SQLite's `sqlite3.Connection` has native `__enter__`/`__exit__` support
- PostgreSQL's `psycopg2` connection requires wrapping to provide the same interface
- Always test database code with both SQLite (local) and PostgreSQL (production) before deploying

## FastAPI Import Checks

### Runtime Import Validation
Static analysis tools (linters, type checkers) may miss missing imports in FastAPI apps because:
- Pydantic models are evaluated at class definition time
- Some imports are only used in type hints
- Errors surface at runtime during module import

**Pre-deployment check**: Always run `python -c "import app.main"` before committing backend changes to catch missing imports early.

Common missing imports to watch for:
- `from typing import List, Dict, Any, Optional` in schemas.py
- `from datetime import date, datetime` in main.py when using date types
- `from pydantic import BaseModel` when creating request models inline

## Railway Deployment

### Verification Required
A "successful" Railway deployment doesn't guarantee the app is healthy:
1. Check the actual application logs for startup errors
2. Verify the health endpoint responds: `curl $PROD_URL/health`
3. Railway may show SUCCESS even if migrations fail or ports are misconfigured

### Port Configuration
- The app binds to port from `PORT` env variable (Railway sets this)
- Dockerfile should use: `CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}`
- Health checks should be configured to `/health` endpoint

## Agent Task Patterns

### Complexity Management
When sub-agents repeatedly fail on complex features:
1. Simplify requirements (remove encryption, complex algorithms)
2. Match existing code patterns exactly
3. Break into smaller, independent sub-tasks
4. Require commits after each major component

### Feature Implementation Order
For new features requiring database + API + frontend:
1. Database schema migrations first
2. Backend API endpoints (test with curl before moving on)
3. Frontend integration
4. End-to-end testing

Don't declare "complete" until all layers are verified working.

## PostgreSQL-Specific Patterns

### Placeholder Conversion
The `PostgresConnectionWrapper` automatically converts `?` placeholders (SQLite style) to `%s` (PostgreSQL style):

```python
# Write queries with ? placeholders (SQLite compatible)
cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
# Wrapper automatically converts to %s for PostgreSQL
```

### RETURNING Clause
For INSERT statements, append `RETURNING id` to get the inserted row ID:

```python
sql_with_returning = f"{sql.rstrip(';')} RETURNING id"
cursor.execute(sql_with_returning, params)
result = cursor.fetchone()
lastrowid = result[0] if result else None
```

## Testing Checklist

Before declaring any feature "complete":
- [ ] Backend imports without errors: `python -c "import app.main"`
- [ ] Server starts: `uvicorn app.main:app` (no startup errors)
- [ ] Health endpoint: 200 OK
- [ ] All new endpoints appear in `/docs` (Swagger UI)
- [ ] Frontend builds: `npm run build` (no errors)
- [ ] Production deployment healthy: `curl $PROD_URL/health`

---

**Updated**: 2026-02-12
**Context**: Lessons from 17-feature UX sprint deployment
