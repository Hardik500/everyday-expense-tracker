# Phase 3 Feature Endpoints for Expense Tracker
# Features: 14-20

from fastapi import APIRouter, HTTPException, Depends, Query, Body
from typing import List, Dict, Any, Optional
from datetime import datetime, date, timedelta
import calendar
import json
from difflib import SequenceMatcher

from app.db import get_conn, IS_POSTGRES
from app import schemas
from app.auth import get_current_user

router = APIRouter(prefix="/api/v1")


# =============================================================================
# FEATURE 14: DATA BACKUP (Export/Import)
# =============================================================================

@router.get("/backup/export")
def export_backup(
    current_user: schemas.User = Depends(get_current_user)
):
    """Export all user data as JSON for backup."""
    with get_conn() as conn:
        data = {
            "version": "1.0",
            "exported_at": datetime.utcnow().isoformat(),
            "user": {
                "id": current_user.id,
                "username": current_user.username,
                "email": current_user.email,
                "full_name": current_user.full_name
            }
        }
        
        # Export accounts
        rows = conn.execute(
            "SELECT id, name, type, currency, upgraded_from_id FROM accounts WHERE user_id = ?",
            (current_user.id,)
        ).fetchall()
        data["accounts"] = [dict(row) for row in rows]
        
        # Export categories
        rows = conn.execute(
            "SELECT id, name, color, monthly_budget, icon FROM categories WHERE user_id = ?",
            (current_user.id,)
        ).fetchall()
        data["categories"] = [dict(row) for row in rows]
        
        # Export subcategories
        rows = conn.execute(
            "SELECT id, category_id, name FROM subcategories WHERE user_id = ?",
            (current_user.id,)
        ).fetchall()
        data["subcategories"] = [dict(row) for row in rows]
        
        # Export transactions (limit to last 2 years to avoid huge exports)
        rows = conn.execute(
            """
            SELECT t.id, t.account_id, t.posted_at, t.amount, t.currency, 
                   t.description_raw, t.description_norm, t.category_id, 
                   t.subcategory_id, t.is_uncertain, t.notes
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE a.user_id = ? AND t.posted_at >= date('now', '-2 years')
            ORDER BY t.posted_at DESC
            """,
            (current_user.id,)
        ).fetchall()
        data["transactions"] = [dict(row) for row in rows]
        
        # Export rules
        rows = conn.execute(
            """
            SELECT id, name, pattern, category_id, subcategory_id, 
                   min_amount, max_amount, priority, account_type, 
                   merchant_contains, active
            FROM rules WHERE user_id = ?
            """,
            (current_user.id,)
        ).fetchall()
        data["rules"] = [dict(row) for row in rows]
        
        # Export recurring expenses
        rows = conn.execute(
            """
            SELECT id, name, description, amount, currency, frequency,
                   interval_days, category_id, subcategory_id, account_id,
                   start_date, end_date, next_due_date, is_active,
                   merchant_pattern, alert_days_before
            FROM recurring_expenses WHERE user_id = ?
            """,
            (current_user.id,)
        ).fetchall()
        data["recurring_expenses"] = [dict(row) for row in rows]
        
        # Export goals
        rows = conn.execute(
            """
            SELECT id, name, description, target_amount, current_amount,
                   category_id, deadline, icon, color, is_active
            FROM goals WHERE user_id = ?
            """,
            (current_user.id,)
        ).fetchall()
        data["goals"] = [dict(row) for row in rows]
        
        # Record backup metadata
        conn.execute(
            """
            INSERT INTO backup_metadata (user_id, backup_version, transaction_count, category_count)
            VALUES (?, ?, ?, ?)
            """,
            (current_user.id, "1.0", len(data["transactions"]), len(data["categories"]))
        )
        conn.commit()
        
        return {
            "status": "ok",
            "data": data,
            "summary": {
                "accounts": len(data["accounts"]),
                "categories": len(data["categories"]),
                "transactions": len(data["transactions"]),
                "rules": len(data["rules"]),
                "recurring_expenses": len(data["recurring_expenses"]),
                "goals": len(data["goals"])
            }
        }


@router.post("/backup/import")
def import_backup(
    backup_data: Dict[str, Any] = Body(...),
    current_user: schemas.User = Depends(get_current_user)
):
    """Import user data from JSON backup."""
    with get_conn() as conn:
        # Validate backup data
        if not backup_data or "version" not in backup_data:
            raise HTTPException(status_code=400, detail="Invalid backup data: missing version")
        
        version = backup_data.get("version", "1.0")
        if version not in ("1.0", "1.1"):
            raise HTTPException(status_code=400, detail=f"Unsupported backup version: {version}")
        
        # Import categories first (they're referenced by other tables)
        category_id_map = {}
        if "categories" in backup_data:
            for cat in backup_data["categories"]:
                old_id = cat.pop("id", None)
                # Check if category already exists
                existing = conn.execute(
                    "SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND user_id = ?",
                    (cat.get("name", ""), current_user.id)
                ).fetchone()
                
                if existing:
                    category_id_map[old_id] = existing["id"]
                else:
                    cursor = conn.execute(
                        """
                        INSERT INTO categories (name, color, monthly_budget, icon, user_id)
                        VALUES (?, ?, ?, ?, ?)
                        """,
                        (cat.get("name"), cat.get("color"), 
                         cat.get("monthly_budget"), cat.get("icon"), current_user.id)
                    )
                    category_id_map[old_id] = cursor.lastrowid
        
        # Import subcategories
        subcategory_id_map = {}
        if "subcategories" in backup_data:
            for sub in backup_data["subcategories"]:
                old_id = sub.pop("id", None)
                old_cat_id = sub.get("category_id")
                new_cat_id = category_id_map.get(old_cat_id) if old_cat_id else None
                
                if new_cat_id:
                    existing = conn.execute(
                        "SELECT id FROM subcategories WHERE LOWER(name) = LOWER(?) AND category_id = ? AND user_id = ?",
                        (sub.get("name", ""), new_cat_id, current_user.id)
                    ).fetchone()
                    
                    if existing:
                        subcategory_id_map[old_id] = existing["id"]
                    else:
                        cursor = conn.execute(
                            "INSERT INTO subcategories (category_id, name, user_id) VALUES (?, ?, ?)",
                            (new_cat_id, sub.get("name"), current_user.id)
                        )
                        subcategory_id_map[old_id] = cursor.lastrowid
        
        # Import accounts
        account_id_map = {}
        if "accounts" in backup_data:
            for acc in backup_data["accounts"]:
                old_id = acc.pop("id", None)
                existing = conn.execute(
                    "SELECT id FROM accounts WHERE LOWER(name) = LOWER(?) AND user_id = ?",
                    (acc.get("name", ""), current_user.id)
                ).fetchone()
                
                if existing:
                    account_id_map[old_id] = existing["id"]
                else:
                    cursor = conn.execute(
                        "INSERT INTO accounts (name, type, currency, user_id) VALUES (?, ?, ?, ?)",
                        (acc.get("name"), acc.get("type"), acc.get("currency", "INR"), current_user.id)
                    )
                    account_id_map[old_id] = cursor.lastrowid
        
        # Import transactions
        imported_txns = 0
        if "transactions" in backup_data:
            for txn in backup_data["transactions"]:
                # Map foreign keys
                old_acc_id = txn.pop("account_id", None)
                new_acc_id = account_id_map.get(old_acc_id)
                if not new_acc_id:
                    continue
                
                old_cat_id = txn.pop("category_id", None)
                new_cat_id = category_id_map.get(old_cat_id) if old_cat_id else None
                
                old_subcat_id = txn.pop("subcategory_id", None)
                new_subcat_id = subcategory_id_map.get(old_subcat_id) if old_subcat_id else None
                
                # Check for duplicate (same account, amount, date, description)
                existing = conn.execute(
                    """
                    SELECT id FROM transactions 
                    WHERE account_id = ? AND posted_at = ? AND amount = ? AND description_raw = ?
                    """,
                    (new_acc_id, txn.get("posted_at"), txn.get("amount"), txn.get("description_raw"))
                ).fetchone()
                
                if not existing:
                    conn.execute(
                        """
                        INSERT INTO transactions 
                        (account_id, posted_at, amount, currency, description_raw, description_norm,
                         category_id, subcategory_id, is_uncertain, notes, user_id)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (new_acc_id, txn.get("posted_at"), txn.get("amount"), 
                         txn.get("currency", "INR"), txn.get("description_raw"), 
                         txn.get("description_norm", txn.get("description_raw", "").lower()),
                         new_cat_id, new_subcat_id, 
                         txn.get("is_uncertain", False), txn.get("notes"), current_user.id)
                    )
                    imported_txns += 1
        
        # Import goals
        imported_goals = 0
        if "goals" in backup_data:
            for goal in backup_data["goals"]:
                old_cat_id = goal.pop("category_id", None)
                new_cat_id = category_id_map.get(old_cat_id) if old_cat_id else None
                
                existing = conn.execute(
                    "SELECT id FROM goals WHERE name = ? AND user_id = ?",
                    (goal.get("name"), current_user.id)
                ).fetchone()
                
                if not existing:
                    is_active = 1 if goal.get("is_active", True) else 0
                    conn.execute(
                        """
                        INSERT INTO goals 
                        (user_id, name, description, target_amount, current_amount, category_id,
                         deadline, icon, color, is_active)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (current_user.id, goal.get("name"), goal.get("description"),
                         goal.get("target_amount", 0), goal.get("current_amount", 0),
                         new_cat_id, goal.get("deadline"), goal.get("icon"),
                         goal.get("color", "#6366f1"), is_active)
                    )
                    imported_goals += 1
        
        conn.commit()
        
        return {
            "status": "ok",
            "imported": {
                "categories": len(category_id_map),
                "subcategories": len(subcategory_id_map),
                "accounts": len(account_id_map),
                "transactions": imported_txns,
                "goals": imported_goals
            }
        }


# =============================================================================
# FEATURE 15: DUPLICATE DETECTION
# =============================================================================

def calculate_similarity(desc1: str, desc2: str) -> float:
    """Calculate similarity between two description strings."""
    return SequenceMatcher(None, desc1.lower(), desc2.lower()).ratio()


def get_date_diff_sql():
    """Get SQL for date difference based on database type."""
    if IS_POSTGRES:
        return "EXTRACT(DAY FROM (t2.posted_at - t1.posted_at))"
    return "julianday(t2.posted_at) - julianday(t1.posted_at)"


@router.get("/duplicates/detect", response_model=List[schemas.DuplicateTransaction])
def detect_duplicates(
    days: int = Query(90, ge=1, le=365),
    similarity_threshold: float = Query(0.85, ge=0.5, le=1.0),
    current_user: schemas.User = Depends(get_current_user)
):
    """Scan for potential duplicate transactions."""
    with get_conn() as conn:
        # Get recent transactions
        cutoff_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
        
        rows = conn.execute(
            """
            SELECT t.id, t.amount, t.description_raw, t.description_norm, t.posted_at, t.currency
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE a.user_id = ? AND t.posted_at >= ?
            ORDER BY ABS(t.amount) DESC, t.posted_at DESC
            """,
            (current_user.id, cutoff_date)
        ).fetchall()
        
        transactions = [dict(row) for row in rows]
        
        # Find duplicates based on amount + date proximity + description similarity
        duplicates = []
        seen_pairs = set()
        
        for i, t1 in enumerate(transactions):
            for t2 in transactions[i+1:]:
                # Skip if already processed
                pair_key = tuple(sorted([t1['id'], t2['id']]))
                if pair_key in seen_pairs:
                    continue
                seen_pairs.add(pair_key)
                
                # Check amount match (within 1% tolerance or Rs. 1)
                amt_diff = abs(abs(t1['amount']) - abs(t2['amount']))
                amt_pct = abs(t1['amount']) * 0.01
                amounts_match = amt_diff <= amt_pct or amt_diff <= 1
                
                if not amounts_match:
                    continue
                
                # Check date proximity (within 3 days)
                d1 = datetime.strptime(str(t1['posted_at']), '%Y-%m-%d').date()
                d2 = datetime.strptime(str(t2['posted_at']), '%Y-%m-%d').date()
                date_diff = abs((d1 - d2).days)
                
                if date_diff > 3:
                    continue
                
                # Calculate description similarity
                desc_sim = calculate_similarity(
                    t1['description_norm'] or t1['description_raw'],
                    t2['description_norm'] or t2['description_raw']
                )
                
                if desc_sim >= similarity_threshold:
                    # Check if already in duplicate_pairs table
                    existing = conn.execute(
                        "SELECT id, status FROM duplicate_pairs WHERE (original_transaction_id = ? AND duplicate_transaction_id = ?) OR (original_transaction_id = ? AND duplicate_transaction_id = ?)",
                        (t1['id'], t2['id'], t2['id'], t1['id'])
                    ).fetchone()
                    
                    if existing and existing['status'] == 'not_duplicate':
                        continue
                    
                    status = existing['status'] if existing else 'pending'
                    dup_id = existing['id'] if existing else None
                    
                    duplicates.append(schemas.DuplicateTransaction(
                        id=dup_id or 0,
                        original_transaction_id=t1['id'],
                        duplicate_transaction_id=t2['id'],
                        similarity_score=desc_sim,
                        status=status,
                        created_at=datetime.now(),
                        original_amount=t1['amount'],
                        original_description=t1['description_raw'],
                        original_date=d1,
                        duplicate_amount=t2['amount'],
                        duplicate_description=t2['description_raw'],
                        duplicate_date=d2
                    ))
        
        return sorted(duplicates, key=lambda x: x.similarity_score, reverse=True)


@router.post("/duplicates/action")
def handle_duplicate_action(
    request: schemas.DuplicateActionRequest,
    current_user: schemas.User = Depends(get_current_user)
):
    """Mark a duplicate pair as duplicate, not duplicate, or delete the duplicate."""
    with get_conn() as conn:
        # Get the duplicate pair
        pair = conn.execute(
            "SELECT * FROM duplicate_pairs WHERE id = ? AND user_id = ?",
            (request.pair_id, current_user.id)
        ).fetchone()
        
        if not pair:
            raise HTTPException(status_code=404, detail="Duplicate pair not found")
        
        if request.action == 'delete_duplicate':
            # Delete the duplicate transaction
            conn.execute(
                "DELETE FROM transactions WHERE id = ?",
                (pair['duplicate_transaction_id'],)
            )
            conn.execute(
                "DELETE FROM duplicate_pairs WHERE id = ?",
                (request.pair_id,)
            )
            conn.commit()
            return {"status": "ok", "action": "deleted"}
        
        elif request.action in ('mark_duplicate', 'not_duplicate'):
            new_status = 'confirmed_duplicate' if request.action == 'mark_duplicate' else 'not_duplicate'
            conn.execute(
                "UPDATE duplicate_pairs SET status = ? WHERE id = ?",
                (new_status, request.pair_id)
            )
            conn.commit()
            return {"status": "ok", "action": new_status}
        
        else:
            raise HTTPException(status_code=400, detail="Invalid action")


@router.post("/transactions/merge")
def merge_transactions(
    transaction_ids: List[int] = Body(..., embed=True),
    keep_transaction_id: int = Body(..., embed=True),
    current_user: schemas.User = Depends(get_current_user)
):
    """Merge multiple duplicate transactions into one.
    
    - Combines notes and categories from all transactions
    - Keeps the data from keep_transaction_id
    - Deletes the other transaction_ids
    """
    if len(transaction_ids) < 2:
        raise HTTPException(status_code=400, detail="At least 2 transactions required for merge")
    
    if keep_transaction_id not in transaction_ids:
        raise HTTPException(status_code=400, detail="keep_transaction_id must be in transaction_ids")
    
    with get_conn() as conn:
        # Verify all transactions belong to user
        placeholders = ','.join('?' * len(transaction_ids))
        rows = conn.execute(
            f"""
            SELECT t.id, t.notes, t.category_id, t.subcategory_id
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE t.id IN ({placeholders}) AND a.user_id = ?
            """,
            (*transaction_ids, current_user.id)
        ).fetchall()
        
        found_ids = {row['id'] for row in rows}
        if len(found_ids) != len(transaction_ids):
            raise HTTPException(status_code=404, detail="One or more transactions not found")
        
        # Get the keep transaction
        keep_txn = next((r for r in rows if r['id'] == keep_transaction_id), None)
        if not keep_txn:
            raise HTTPException(status_code=404, detail="Keep transaction not found")
        
        # Compile combined metadata from all transactions
        all_notes = []
        all_categories = set()
        all_subcategories = set()
        
        for row in rows:
            if row['notes']:
                all_notes.append(row['notes'])
            if row['category_id']:
                all_categories.add(row['category_id'])
            if row['subcategory_id']:
                all_subcategories.add(row['subcategory_id'])
        
        # Update keep transaction with combined notes
        combined_notes = keep_txn['notes'] or ""
        if all_notes:
            for note in all_notes:
                if note and note != combined_notes:
                    combined_notes = f"{combined_notes}\nMerged from duplicate: {note}".strip()
        
        if combined_notes:
            conn.execute(
                "UPDATE transactions SET notes = ? WHERE id = ?",
                (combined_notes, keep_transaction_id)
            )
        
        # Delete other transactions
        ids_to_delete = [tid for tid in transaction_ids if tid != keep_transaction_id]
        for tid in ids_to_delete:
            # Delete any duplicate pair references
            conn.execute(
                "DELETE FROM duplicate_pairs WHERE original_transaction_id = ? OR duplicate_transaction_id = ?",
                (tid, tid)
            )
            # Delete the transaction
            conn.execute(
                "DELETE FROM transactions WHERE id = ?",
                (tid,)
            )
        
        conn.commit()
        
        return {
            "status": "ok",
            "kept_transaction_id": keep_transaction_id,
            "deleted_count": len(ids_to_delete),
            "combined_notes": combined_notes if combined_notes else None
        }


# =============================================================================
# FEATURE 16: SPLIT TRANSACTIONS
# =============================================================================

@router.get("/transactions/{transaction_id}/splits", response_model=List[schemas.TransactionSplit])
def get_transaction_splits(
    transaction_id: int,
    current_user: schemas.User = Depends(get_current_user)
):
    """Get all splits for a transaction."""
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
        
        rows = conn.execute(
            """
            SELECT s.*, c.name as category_name, sc.name as subcategory_name
            FROM transaction_splits s
            LEFT JOIN categories c ON s.category_id = c.id
            LEFT JOIN subcategories sc ON s.subcategory_id = sc.id
            WHERE s.transaction_id = ? AND s.user_id = ?
            ORDER BY s.id
            """,
            (transaction_id, current_user.id)
        ).fetchall()
        
        return [
            schemas.TransactionSplit(**dict(row)) for row in rows
        ]


@router.post("/transactions/{transaction_id}/split")
def split_transaction(
    transaction_id: int,
    request: schemas.SplitTransactionRequest,
    current_user: schemas.User = Depends(get_current_user)
):
    """Split a transaction into multiple categories."""
    with get_conn() as conn:
        # Verify transaction belongs to user and get amount
        txn = conn.execute(
            """
            SELECT t.id, t.amount FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE t.id = ? AND a.user_id = ?
            """,
            (transaction_id, current_user.id)
        ).fetchone()
        
        if not txn:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        total_split_amount = sum(s.amount for s in request.splits)
        
        # Validate split amounts match transaction amount
        if abs(total_split_amount - abs(txn['amount'])) > 0.01:
            raise HTTPException(
                status_code=400, 
                detail=f"Split amounts ({total_split_amount}) must equal transaction amount ({abs(txn['amount'])})"
            )
        
        # Delete existing splits for this transaction
        conn.execute(
            "DELETE FROM transaction_splits WHERE transaction_id = ? AND user_id = ?",
            (transaction_id, current_user.id)
        )
        
        # Insert new splits
        for split in request.splits:
            conn.execute(
                """
                INSERT INTO transaction_splits 
                (transaction_id, user_id, category_id, subcategory_id, amount, description)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (transaction_id, current_user.id, split.category_id, split.subcategory_id, 
                 split.amount, split.description)
            )
        
        conn.commit()
        return {"status": "ok", "splits_created": len(request.splits)}


@router.delete("/transactions/{transaction_id}/splits")
def delete_transaction_splits(
    transaction_id: int,
    current_user: schemas.User = Depends(get_current_user)
):
    """Remove all splits from a transaction."""
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
        
        conn.execute(
            "DELETE FROM transaction_splits WHERE transaction_id = ? AND user_id = ?",
            (transaction_id, current_user.id)
        )
        
        conn.commit()
        return {"status": "ok"}


# =============================================================================
# FEATURE 17: GOALS/SAVINGS TRACKING
# =============================================================================

def get_days_remaining_sql():
    """Get SQL for days remaining calculation."""
    if IS_POSTGRES:
        return "EXTRACT(DAY FROM (g.deadline - CURRENT_DATE))::INTEGER"
    return "CAST(julianday(g.deadline) - julianday('now') AS INTEGER)"


@router.get("/goals", response_model=List[schemas.Goal])
def list_goals(
    include_inactive: bool = Query(False),
    current_user: schemas.User = Depends(get_current_user)
):
    """List all goals for the user."""
    with get_conn() as conn:
        days_sql = get_days_remaining_sql()
        
        where_clause = "WHERE g.user_id = ?"
        params = [current_user.id]
        
        if not include_inactive:
            where_clause += " AND g.is_active = TRUE"
        
        order_by = "ORDER BY CASE WHEN g.deadline IS NULL THEN 1 ELSE 0 END, g.deadline ASC, g.created_at DESC"
        
        rows = conn.execute(
            f"""
            SELECT g.*, c.name as category_name,
                   COALESCE((g.current_amount * 100.0 / NULLIF(g.target_amount, 0)), 0) as progress_percent,
                   {days_sql} as days_remaining
            FROM goals g
            LEFT JOIN categories c ON g.category_id = c.id
            {where_clause}
            {order_by}
            """,
            params
        ).fetchall()
        
        return [schemas.Goal(**dict(row)) for row in rows]


@router.post("/goals", response_model=schemas.Goal)
def create_goal(
    request: schemas.GoalCreate,
    current_user: schemas.User = Depends(get_current_user)
):
    """Create a new savings goal."""
    with get_conn() as conn:
        # Validate category if provided
        if request.category_id:
            cat = conn.execute(
                "SELECT id FROM categories WHERE id = ? AND user_id = ?",
                (request.category_id, current_user.id)
            ).fetchone()
            if not cat:
                raise HTTPException(status_code=404, detail="Category not found")
        
        is_active_val = True if IS_POSTGRES else 1
        cursor = conn.execute(
            """
            INSERT INTO goals 
            (user_id, name, description, target_amount, current_amount, category_id, 
             deadline, icon, color, is_active)
            VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
            """,
            (current_user.id, request.name, request.description, request.target_amount,
             request.category_id, request.deadline, request.icon, request.color, is_active_val)
        )
        conn.commit()
        
        goal_id = cursor.lastrowid
        
        # Return with computed fields
        days_sql = get_days_remaining_sql()
        row = conn.execute(
            f"""
            SELECT g.*, c.name as category_name,
                   COALESCE((g.current_amount * 100.0 / NULLIF(g.target_amount, 0)), 0) as progress_percent,
                   {days_sql} as days_remaining
            FROM goals g
            LEFT JOIN categories c ON g.category_id = c.id
            WHERE g.id = ?
            """,
            (goal_id,)
        ).fetchone()
        
        return schemas.Goal(**dict(row))


@router.get("/goals/{goal_id}", response_model=schemas.Goal)
def get_goal(
    goal_id: int,
    current_user: schemas.User = Depends(get_current_user)
):
    """Get a specific goal."""
    with get_conn() as conn:
        days_sql = get_days_remaining_sql()
        
        row = conn.execute(
            f"""
            SELECT g.*, c.name as category_name,
                   COALESCE((g.current_amount * 100.0 / NULLIF(g.target_amount, 0)), 0) as progress_percent,
                   {days_sql} as days_remaining
            FROM goals g
            LEFT JOIN categories c ON g.category_id = c.id
            WHERE g.id = ? AND g.user_id = ?
            """,
            (goal_id, current_user.id)
        ).fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="Goal not found")
        
        return schemas.Goal(**dict(row))


@router.patch("/goals/{goal_id}", response_model=schemas.Goal)
def update_goal(
    goal_id: int,
    request: schemas.GoalUpdate,
    current_user: schemas.User = Depends(get_current_user)
):
    """Update a goal."""
    with get_conn() as conn:
        # Check goal exists
        goal = conn.execute(
            "SELECT * FROM goals WHERE id = ? AND user_id = ?",
            (goal_id, current_user.id)
        ).fetchone()
        
        if not goal:
            raise HTTPException(status_code=404, detail="Goal not found")
        
        # Build update
        updates = []
        values = []
        
        update_data = request.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if value is not None:
                updates.append(f"{field} = ?")
                values.append(value)
        
        if updates:
            if IS_POSTGRES:
                updates.append("updated_at = CURRENT_TIMESTAMP")
            else:
                updates.append("updated_at = CURRENT_TIMESTAMP")
            values.extend([goal_id, current_user.id])
            
            conn.execute(
                f"UPDATE goals SET {', '.join(updates)} WHERE id = ? AND user_id = ?",
                values
            )
            conn.commit()
        
        return get_goal(goal_id, current_user)


@router.delete("/goals/{goal_id}")
def delete_goal(
    goal_id: int,
    current_user: schemas.User = Depends(get_current_user)
):
    """Delete a goal."""
    with get_conn() as conn:
        result = conn.execute(
            "DELETE FROM goals WHERE id = ? AND user_id = ?",
            (goal_id, current_user.id)
        )
        conn.commit()
        
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Goal not found")
        
        return {"status": "ok"}


@router.post("/goals/{goal_id}/contribute")
def contribute_to_goal(
    goal_id: int,
    amount: float,
    notes: Optional[str] = None,
    current_user: schemas.User = Depends(get_current_user)
):
    """Add funds to a goal."""
    with get_conn() as conn:
        goal = conn.execute(
            "SELECT * FROM goals WHERE id = ? AND user_id = ?",
            (goal_id, current_user.id)
        ).fetchone()
        
        if not goal:
            raise HTTPException(status_code=404, detail="Goal not found")
        
        new_amount = goal['current_amount'] + amount
        
        if IS_POSTGRES:
            conn.execute(
                "UPDATE goals SET current_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (new_amount, goal_id)
            )
        else:
            conn.execute(
                "UPDATE goals SET current_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (new_amount, goal_id)
            )
        
        conn.commit()
        
        # Calculate progress
        progress = (new_amount / goal['target_amount'] * 100) if goal['target_amount'] > 0 else 0
        
        return {
            "status": "ok",
            "new_amount": new_amount,
            "progress_percent": min(progress, 100),
            "is_complete": new_amount >= goal['target_amount']
        }


# =============================================================================
# FEATURE 18: NET WORTH TRACKER
# =============================================================================

@router.get("/net-worth/summary", response_model=schemas.NetWorthSummary)
def get_net_worth(
    months: int = Query(12, ge=1, le=60),
    current_user: schemas.User = Depends(get_current_user)
):
    """Get current net worth and historical data."""
    with get_conn() as conn:
        # Calculate current net worth from transactions and account balances
        # Assets = positive balances in bank/cash/investment accounts
        # Liabilities = absolute balances in cards/loans
        
        # Get account balances from account_transactions
        row = conn.execute(
            """
            SELECT 
                SUM(CASE 
                    WHEN a.type IN ('bank', 'cash') THEN COALESCE(
                        (SELECT SUM(CASE WHEN atx.posted_at > COALESCE(atx2.latest_date, '1970-01-01') THEN atx.balance_change ELSE 0 END)
                         FROM account_transactions atx
                         LEFT JOIN (SELECT MAX(posted_at) as latest_date FROM account_transactions) atx2 ON 1=1
                         WHERE atx.account_id = a.id), 0
                    )
                    ELSE 0 
                END) as assets,
                SUM(CASE 
                    WHEN a.type IN ('card', 'loan') THEN ABS(COALESCE(
                        (SELECT SUM(balance_change) FROM account_transactions WHERE account_id = a.id), 0
                    ))
                    ELSE 0 
                END) as liabilities
            FROM accounts a
            WHERE a.user_id = ?
            """,
            (current_user.id,)
        ).fetchone()
        
        # Simpler calculation using recent transaction totals
        row2 = conn.execute(
            """
            SELECT 
                SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END) as income,
                SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END) as expenses
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE a.user_id = ? AND t.posted_at >= date('now', '-30 days')
            """,
            (current_user.id,)
        ).fetchone()
        
        # Use simplified approach based on account types
        assets = 0
        liabilities = 0
        
        accounts = conn.execute(
            "SELECT type, balance FROM accounts WHERE user_id = ?",
            (current_user.id,)
        ).fetchall()
        
        for acc in accounts:
            balance = acc['balance'] or 0
            if acc['type'] in ('bank', 'cash', 'investment'):
                if balance > 0:
                    assets += balance
            elif acc['type'] in ('card', 'loan'):
                liabilities += abs(balance)
        
        current_net_worth = assets - liabilities
        
        # Get historical data
        rows = conn.execute(
            """
            SELECT * FROM net_worth_history
            WHERE user_id = ?
            ORDER BY recorded_at DESC
            LIMIT ?
            """,
            (current_user.id, months)
        ).fetchall()
        
        history = [schemas.NetWorthEntry(**dict(row)) for row in rows]
        
        # Calculate change from last month
        change = None
        change_pct = None
        if len(history) >= 2:
            last_month = history[0]
            prev_month = history[1]
            change = last_month.net_worth - prev_month.net_worth
            if prev_month.net_worth != 0:
                change_pct = (change / abs(prev_month.net_worth)) * 100
        
        return schemas.NetWorthSummary(
            current_net_worth=current_net_worth,
            total_assets=assets,
            total_liabilities=liabilities,
            change_from_last_month=change,
            change_percent=change_pct,
            history=history
        )


@router.post("/net-worth/record")
def record_net_worth(
    request: schemas.NetWorthCreate,
    current_user: schemas.User = Depends(get_current_user)
):
    """Record a net worth snapshot."""
    with get_conn() as conn:
        recorded_at = request.recorded_at or date.today()
        
        # If no amounts provided, calculate from accounts
        if request.total_assets is None or request.total_liabilities is None:
            assets = 0
            liabilities = 0
            
            accounts = conn.execute(
                "SELECT type, balance FROM accounts WHERE user_id = ?",
                (current_user.id,)
            ).fetchall()
            
            for acc in accounts:
                balance = acc['balance'] or 0
                if acc['type'] in ('bank', 'cash', 'investment'):
                    if balance > 0:
                        assets += balance
                elif acc['type'] in ('card', 'loan'):
                    liabilities += abs(balance)
            
            assets = request.total_assets or assets
            liabilities = request.total_liabilities or liabilities
        else:
            assets = request.total_assets
            liabilities = request.total_liabilities
        
        net_worth = assets - liabilities
        
        # Check if entry exists for this date
        existing = conn.execute(
            "SELECT id FROM net_worth_history WHERE user_id = ? AND recorded_at = ?",
            (current_user.id, recorded_at)
        ).fetchone()
        
        if existing:
            conn.execute(
                """
                UPDATE net_worth_history 
                SET total_assets = ?, total_liabilities = ?, net_worth = ?, notes = ?
                WHERE id = ?
                """,
                (assets, liabilities, net_worth, request.notes, existing['id'])
            )
        else:
            conn.execute(
                """
                INSERT INTO net_worth_history 
                (user_id, recorded_at, total_assets, total_liabilities, net_worth, notes)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (current_user.id, recorded_at, assets, liabilities, net_worth, request.notes)
            )
        
        conn.commit()
        return {"status": "ok", "net_worth": net_worth, "assets": assets, "liabilities": liabilities}


# =============================================================================
# FEATURE 19: MONTHLY REPORTS
# =============================================================================

@router.get("/reports/monthly", response_model=List[schemas.MonthlyReport])
def get_monthly_reports(
    year: Optional[int] = Query(None),
    current_user: schemas.User = Depends(get_current_user)
):
    """Get monthly reports for a year or all time."""
    with get_conn() as conn:
        if year is None:
            year = datetime.now().year
        
        reports = []
        
        for month in range(1, 13):
            try:
                # Get month date range
                start_date = date(year, month, 1)
                end_date = date(year, month, calendar.monthrange(year, month)[1])
                
                # Get income and expenses
                row = conn.execute(
                    """
                    SELECT 
                        SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END) as income,
                        SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END) as expenses
                    FROM transactions t
                    JOIN accounts a ON t.account_id = a.id
                    WHERE a.user_id = ? AND t.posted_at >= ? AND t.posted_at <= ?
                    """,
                    (current_user.id, start_date.isoformat(), end_date.isoformat())
                ).fetchone()
                
                income = row['income'] or 0
                expenses = row['expenses'] or 0
                
                # Get category breakdown
                cat_rows = conn.execute(
                    """
                    SELECT COALESCE(c.id, 0) as category_id, COALESCE(c.name, 'Uncategorized') as category_name, 
                           SUM(ABS(t.amount)) as total
                    FROM transactions t
                    JOIN accounts a ON t.account_id = a.id
                    LEFT JOIN categories c ON t.category_id = c.id
                    WHERE a.user_id = ? AND t.posted_at >= ? AND t.posted_at <= ? AND t.amount < 0
                    GROUP BY c.id
                    ORDER BY total DESC
                    """,
                    (current_user.id, start_date.isoformat(), end_date.isoformat())
                ).fetchall()
                
                categories = [
                    schemas.ReportItem(category_id=row['category_id'], 
                                     category_name=row['category_name'],
                                     total=row['total'])
                    for row in cat_rows
                ]
                
                # Get top expenses
                top_expenses = conn.execute(
                    """
                    SELECT t.posted_at, t.description_raw, ABS(t.amount) as amount
                    FROM transactions t
                    JOIN accounts a ON t.account_id = a.id
                    WHERE a.user_id = ? AND t.posted_at >= ? AND t.posted_at <= ? AND t.amount < 0
                    ORDER BY ABS(t.amount) DESC
                    LIMIT 5
                    """,
                    (current_user.id, start_date.isoformat(), end_date.isoformat())
                ).fetchall()
                
                savings_rate = ((income - expenses) / income * 100) if income > 0 else 0
                
                reports.append(schemas.MonthlyReport(
                    month=calendar.month_name[month],
                    year=year,
                    total_income=income,
                    total_expenses=expenses,
                    net_cashflow=income - expenses,
                    savings_rate=min(max(savings_rate, -100), 100),  # Clamp between -100 and 100
                    category_breakdown=categories,
                    top_expenses=[dict(row) for row in top_expenses],
                    compared_to_prev_month=None
                ))
            except Exception as e:
                # Skip months that error out
                print(f"Error processing month {month}: {e}")
                continue
        
        return reports


# =============================================================================
# FEATURE 20: CASH FLOW CALENDAR
# =============================================================================

@router.get("/calendar/{year}/{month}", response_model=schemas.CashFlowCalendar)
def get_cash_flow_calendar(
    year: int,
    month: int,
    current_user: schemas.User = Depends(get_current_user)
):
    """Get daily cash flow data for a calendar month view."""
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="Invalid month")
    
    with get_conn() as conn:
        # Get month boundaries
        first_day = date(year, month, 1)
        last_day = date(year, month, calendar.monthrange(year, month)[1])
        
        days = []
        month_income = 0
        month_expenses = 0
        
        for day in range(1, last_day.day + 1):
            try:
                current_date = date(year, month, day)
                
                # Get transactions for this day
                rows = conn.execute(
                    """
                    SELECT t.id, t.posted_at, t.amount, t.description_raw, 
                           COALESCE(c.name, 'Uncategorized') as category_name, t.currency
                    FROM transactions t
                    JOIN accounts a ON t.account_id = a.id
                    LEFT JOIN categories c ON t.category_id = c.id
                    WHERE a.user_id = ? AND t.posted_at = ?
                    ORDER BY t.amount ASC, t.id DESC
                    """,
                    (current_user.id, current_date.isoformat())
                ).fetchall()
                
                transactions = [dict(row) for row in rows]
                
                income = sum(t['amount'] for t in transactions if t['amount'] > 0)
                expenses = sum(abs(t['amount']) for t in transactions if t['amount'] < 0)
                
                month_income += income
                month_expenses += expenses
                
                days.append(schemas.CalendarDayData(
                    date=current_date,
                    income=income,
                    expenses=expenses,
                    net=income - expenses,
                    transaction_count=len(transactions),
                    transactions=transactions
                ))
            except Exception as e:
                print(f"Error on day {day}: {e}")
                continue
        
        return schemas.CashFlowCalendar(
            year=year,
            month=month,
            days=days,
            month_total={
                "income": month_income,
                "expenses": month_expenses,
                "net": month_income - month_expenses
            }
        )


# Function to register all routes in main.py (alternative)
def register_phase3_routes(app):
    """Register all Phase 3 routes with the FastAPI app."""
    app.include_router(router)