# Learnings

Corrections, insights, and knowledge gaps captured during development.

**Categories**: correction | insight | knowledge_gap | best_practice
**Areas**: frontend | backend | infra | tests | docs | config
**Statuses**: pending | in_progress | resolved | wont_fix | promoted | promoted_to_skill

## Status Definitions

| Status | Meaning |
|--------|---------|
| `pending` | Not yet addressed |
| `in_progress` | Actively being worked on |
| `resolved` | Issue fixed or knowledge integrated |
| `wont_fix` | Decided not to address (reason in Resolution) |
| `promoted` | Elevated to CLAUDE.md, AGENTS.md, or copilot-instructions.md |
| `promoted_to_skill` | Extracted as a reusable skill |

## Skill Extraction Fields

When a learning is promoted to a skill, add these fields:

```markdown
**Status**: promoted_to_skill
**Skill-Path**: skills/skill-name
```

Example:
```markdown
## [LRN-20250115-001] best_practice

**Logged**: 2025-01-15T10:00:00Z
**Priority**: high
**Status**: promoted_to_skill
**Skill-Path**: skills/docker-m1-fixes
**Area**: infra

### Summary
Docker build fails on Apple Silicon due to platform mismatch
...
```

---


## [LRN-20260212-001] knowledge_gap

**Logged**: 2026-02-12T03:30:00Z
**Priority**: high
**Status**: pending
**Area**: backend

### Summary
After adding new features with Pydantic models, the FastAPI app failed at startup with missing import errors that weren't caught by static analysis or commit-time validation.

### Details
When adding Phase 3 features (RecurringExpense, Goal schemas), the following imports were missing:
1. `List` in schemas.py (used in RecurringExpense.upcoming_payments: Optional[List[RecurringPayment]])
2. `date` in main.py (used in calculate_next_due_date function)
3. `BaseModel` in main.py (used for RecurringExpenseCreateRequest class)
4. `Dict` and `Any` in main.py (used in backup_data endpoint return type)

These errors only surfaced at runtime when attempting to import the module, not during development or commit.

### Suggested Action
1. Add a pre-commit hook or CI step that imports the main app module
2. Use `python -c "import app.main"` as a smoke test before deploying
3. Consider using strict mypy or pyright type checking in CI

### Metadata
- Source: error
- Related Files: backend/app/schemas.py, backend/app/main.py, backend/app/db.py
- Tags: imports, fastapi, pydantic, startup, runtime
- See Also: LRN-20260212-002 (PostgresConnectionWrapper issue)

---

## [LRN-20260212-002] best_practice

**Logged**: 2026-02-12T03:30:00Z
**Priority**: critical
**Status**: promoted
**Area**: backend

### Summary
Custom database connection wrappers must implement the full context manager protocol (__enter__ AND __exit__) to work with `with` statements.

### Details
The PostgresConnectionWrapper class provided execute(), commit(), rollback(), and close() methods but was missing __enter__() and __exit__() methods. This caused:
```
TypeError: 'PostgresConnectionWrapper' object does not support the context manager protocol
```

The fix was adding:
```python
def __enter__(self):
    return self

def __exit__(self, exc_type, exc_val, exc_tb):
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

### Suggested Action
Document this in CLAUDE.md: When wrapping database connections or any context-manager-dependent object, always implement __enter__ and __exit__.

### Resolution
- **Resolved**: 2026-02-12T03:23:00Z
- **Commit**: 2bdce4a
- **Notes**: Applied to db.py, migrations now succeed, app starts successfully

### Metadata
- Source: error
- Related Files: backend/app/db.py
- Tags: database, context-manager, wrapper, postgresql, migration
- **Promoted to**: CLAUDE.md (PostgresConnectionWrapper pattern)

---

## [LRN-20260212-003] best_practice

**Logged**: 2026-02-12T03:32:00Z
**Priority**: high
**Status**: pending
**Area**: infra

### Summary
Before declaring a sprint "complete", always verify the production deployment is actually healthy - not just that code was pushed.

### Details
We had commits pushed to GitHub and Railway showing "Deployment SUCCESS", but:
1. The actual API was returning 502 errors initially
2. Static import checks passed, but runtime database connections failed
3. Local testing passed after fixes, but needed verification against production URL

Key verification steps that caught issues:
- curl https://api.everydayexpensetracker.online/health
- Check Railway dashboard for actual deployment status
- Review logs for silent failures after "startup complete"

### Suggested Action
Add to AGENTS.md workflow: After "push to production", always run `curl $PROD_URL/health` and verify 200 OK before declaring success.

### Metadata
- Source: user_feedback (implicit via deployment questions)
- Related Files: railway.toml (if exists), Dockerfile
- Tags: deployment, production, verification, health-check, railway
- See Also: LRN-20260212-002 (production failed despite successful build)

---

## [LRN-20260212-004] best_practice

**Logged**: 2026-02-12T03:33:00Z
**Priority**: medium
**Status**: pending
**Area**: backend

### Summary
Sub-agents implementing complex features (database migrations, multi-file coordination) repeatedly crashed/aborted without completing the work.

### Details
During Phase 3, agents stopped mid-implementation multiple times when asked to create:
- Database backup endpoints
- Duplicate detection system
- Goals tracking feature

The pattern: Agent would begin work, check schema, then abort without committing.

Workaround that succeeded: Simplified the features (removed encryption, complex algorithms) and matched existing code patterns exactly.

### Suggested Action
1. For complex features, break into smaller sub-tasks
2. Use code generation for boilerplate, only hand-craft complex logic
3. Have agents commit more frequently (after each endpoint)

### Metadata
- Source: error (implicit via agent restarts)
- Related Files: backend/app/phase3_endpoints.py
- Tags: agents, sub-tasks, complexity, patterns
- See Also: LRN-20260212-005 (complexity management)

---
