from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app import schemas
from app.db import apply_migrations, get_conn
from app.ingest.csv import ingest_csv
from app.ingest.ofx import ingest_ofx
from app.ingest.pdf import ingest_pdf
from app.ingest.xls import ingest_xls
from app.linking import link_card_payments
from app.rules.engine import apply_rules
import os

from app.seed import seed_categories_and_rules, seed_statements_from_dir

app = FastAPI(title="Expense Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    apply_migrations()
    seed_categories_and_rules()
    statements_dir = os.getenv("SEED_STATEMENTS_DIR")
    if statements_dir:
        seed_statements_from_dir(Path(statements_dir))


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


@app.post("/accounts", response_model=schemas.Account)
def create_account(payload: schemas.AccountCreate) -> schemas.Account:
    with get_conn() as conn:
        cursor = conn.execute(
            "INSERT INTO accounts (name, type, currency) VALUES (?, ?, ?)",
            (payload.name, payload.type, payload.currency),
        )
        conn.commit()
        account_id = cursor.lastrowid
        row = conn.execute(
            "SELECT id, name, type, currency FROM accounts WHERE id = ?",
            (account_id,),
        ).fetchone()
    return schemas.Account(**dict(row))


@app.get("/accounts", response_model=List[schemas.Account])
def list_accounts() -> List[schemas.Account]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, name, type, currency FROM accounts ORDER BY name"
        ).fetchall()
    return [schemas.Account(**dict(row)) for row in rows]


@app.put("/accounts/{account_id}", response_model=schemas.Account)
def update_account(account_id: int, payload: schemas.AccountCreate) -> schemas.Account:
    with get_conn() as conn:
        existing = conn.execute(
            "SELECT id FROM accounts WHERE id = ?", (account_id,)
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Account not found")
        conn.execute(
            "UPDATE accounts SET name = ?, type = ?, currency = ? WHERE id = ?",
            (payload.name, payload.type, payload.currency, account_id),
        )
        conn.commit()
        row = conn.execute(
            "SELECT id, name, type, currency FROM accounts WHERE id = ?",
            (account_id,),
        ).fetchone()
    return schemas.Account(**dict(row))


@app.delete("/accounts/{account_id}")
def delete_account(account_id: int) -> dict:
    with get_conn() as conn:
        # Check if account has transactions
        txn_count = conn.execute(
            "SELECT COUNT(*) as cnt FROM transactions WHERE account_id = ?",
            (account_id,)
        ).fetchone()["cnt"]
        if txn_count > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete account with {txn_count} transactions. Delete transactions first."
            )
        conn.execute("DELETE FROM accounts WHERE id = ?", (account_id,))
        conn.commit()
    return {"deleted": True, "account_id": account_id}


@app.get("/categories")
def list_categories() -> dict:
    with get_conn() as conn:
        categories = conn.execute(
            "SELECT id, name FROM categories ORDER BY name"
        ).fetchall()
        subcategories = conn.execute(
            "SELECT id, category_id, name FROM subcategories ORDER BY name"
        ).fetchall()
    return {
        "categories": [dict(row) for row in categories],
        "subcategories": [dict(row) for row in subcategories],
    }


@app.post("/rules")
def create_rule(payload: schemas.RuleCreate) -> dict:
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO rules (
                name, pattern, category_id, subcategory_id,
                min_amount, max_amount, priority, account_type,
                merchant_contains, active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
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
            ),
        )
        conn.commit()
    return {"status": "ok"}


@app.get("/rules")
def list_rules() -> List[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT r.id, r.name, r.pattern, r.category_id, r.subcategory_id, r.min_amount,
                   r.max_amount, r.priority, r.account_type, r.merchant_contains, r.active,
                   c.name as category_name, s.name as subcategory_name
            FROM rules r
            LEFT JOIN categories c ON c.id = r.category_id
            LEFT JOIN subcategories s ON s.id = r.subcategory_id
            ORDER BY r.priority DESC, r.name
            """
        ).fetchall()
    return [dict(row) for row in rows]


@app.put("/rules/{rule_id}")
def update_rule(rule_id: int, payload: schemas.RuleCreate) -> dict:
    with get_conn() as conn:
        existing = conn.execute("SELECT id FROM rules WHERE id = ?", (rule_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Rule not found")
        conn.execute(
            """
            UPDATE rules SET
                name = ?, pattern = ?, category_id = ?, subcategory_id = ?,
                min_amount = ?, max_amount = ?, priority = ?, account_type = ?,
                merchant_contains = ?
            WHERE id = ?
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
            ),
        )
        conn.commit()
    return {"status": "ok", "rule_id": rule_id}


@app.delete("/rules/{rule_id}")
def delete_rule(rule_id: int) -> dict:
    with get_conn() as conn:
        conn.execute("DELETE FROM rules WHERE id = ?", (rule_id,))
        conn.commit()
    return {"deleted": True, "rule_id": rule_id}


@app.patch("/rules/{rule_id}/toggle")
def toggle_rule(rule_id: int) -> dict:
    with get_conn() as conn:
        existing = conn.execute("SELECT active FROM rules WHERE id = ?", (rule_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Rule not found")
        new_active = 0 if existing["active"] else 1
        conn.execute("UPDATE rules SET active = ? WHERE id = ?", (new_active, rule_id))
        conn.commit()
    return {"rule_id": rule_id, "active": bool(new_active)}


@app.post("/ingest")
def ingest_statement(
    account_id: int = Form(...),
    source: str = Form(...),
    file: UploadFile = File(...),
    profile: Optional[str] = Form(None),
) -> dict:
    if source not in {"csv", "ofx", "xls", "pdf"}:
        raise HTTPException(
            status_code=400, detail="source must be csv, ofx, xls, or pdf"
        )
    content = file.file.read()
    file_name = file.filename or "upload"

    with get_conn() as conn:
        statement_id = conn.execute(
            "INSERT INTO statements (account_id, source, file_name) VALUES (?, ?, ?)",
            (account_id, source, file_name),
        ).lastrowid
        conn.commit()

        if source == "csv":
            inserted, skipped = ingest_csv(
                conn, account_id, statement_id, content, profile
            )
        elif source == "xls":
            inserted, skipped = ingest_xls(
                conn, account_id, statement_id, content, profile
            )
        elif source == "pdf":
            inserted, skipped = ingest_pdf(conn, account_id, statement_id, content)
        else:
            inserted, skipped = ingest_ofx(conn, account_id, statement_id, content)

        apply_rules(conn, account_id=account_id, statement_id=statement_id)
        link_card_payments(conn, account_id=account_id)
        conn.commit()

    return {
        "inserted": inserted,
        "skipped": skipped,
        "statement_id": statement_id,
    }


@app.get("/transactions", response_model=List[schemas.Transaction])
def list_transactions(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    category_id: Optional[int] = None,
    uncertain: Optional[bool] = None,
) -> List[schemas.Transaction]:
    clauses = []
    params: List[object] = []

    if start_date:
        clauses.append("posted_at >= ?")
        params.append(start_date)
    if end_date:
        clauses.append("posted_at <= ?")
        params.append(end_date)
    if category_id:
        clauses.append("category_id = ?")
        params.append(category_id)
    if uncertain is not None:
        clauses.append("is_uncertain = ?")
        params.append(1 if uncertain else 0)

    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    query = f"""
        SELECT id, account_id, posted_at, amount, currency, description_raw,
               description_norm, category_id, subcategory_id, is_uncertain
        FROM transactions
        {where}
        ORDER BY posted_at DESC, id DESC
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
) -> StreamingResponse:
    """Export transactions as CSV."""
    clauses = []
    params: List[object] = []

    if start_date:
        clauses.append("t.posted_at >= ?")
        params.append(start_date)
    if end_date:
        clauses.append("t.posted_at <= ?")
        params.append(end_date)
    if category_id:
        clauses.append("t.category_id = ?")
        params.append(category_id)

    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
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
            row["posted_at"][:10],
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


@app.patch("/transactions/{transaction_id}")
def update_transaction(
    transaction_id: int, payload: schemas.TransactionUpdate
) -> dict:
    with get_conn() as conn:
        tx = conn.execute(
            "SELECT description_norm FROM transactions WHERE id = ?",
            (transaction_id,),
        ).fetchone()
        if not tx:
            raise HTTPException(status_code=404, detail="Transaction not found")

        conn.execute(
            """
            UPDATE transactions
            SET category_id = ?, subcategory_id = ?, is_uncertain = 0
            WHERE id = ?
            """,
            (payload.category_id, payload.subcategory_id, transaction_id),
        )
        if payload.create_mapping and payload.category_id:
            conn.execute(
                """
                INSERT OR REPLACE INTO mappings
                (description_norm, category_id, subcategory_id)
                VALUES (?, ?, ?)
                """,
                (
                    tx["description_norm"],
                    payload.category_id,
                    payload.subcategory_id,
                ),
            )
        conn.commit()
    return {"status": "ok"}


@app.get("/transactions/{transaction_id}/similar")
def find_similar_transactions(transaction_id: int) -> dict:
    """Find transactions with similar descriptions."""
    import re
    
    with get_conn() as conn:
        tx = conn.execute(
            "SELECT description_norm FROM transactions WHERE id = ?",
            (transaction_id,),
        ).fetchone()
        if not tx:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        desc = tx["description_norm"]
        
        # Extract key words (first 2-3 significant words)
        words = [w for w in desc.split() if len(w) > 2 and not w.isdigit()][:3]
        if not words:
            return {"similar": [], "pattern": "", "count": 0}
        
        # Build a search pattern
        pattern = "%".join(words[:2]) if len(words) >= 2 else words[0]
        search_pattern = f"%{pattern}%"
        
        similar = conn.execute(
            """
            SELECT id, description_norm, amount, posted_at, category_id, subcategory_id
            FROM transactions
            WHERE description_norm LIKE ?
            ORDER BY posted_at DESC
            LIMIT 100
            """,
            (search_pattern,),
        ).fetchall()
        
        return {
            "similar": [dict(row) for row in similar],
            "pattern": pattern,
            "count": len(similar),
        }


@app.post("/transactions/bulk-update")
def bulk_update_transactions(
    transaction_ids: List[int] = Form(...),
    category_id: int = Form(...),
    subcategory_id: Optional[int] = Form(None),
    create_rule: bool = Form(False),
    rule_pattern: Optional[str] = Form(None),
    rule_name: Optional[str] = Form(None),
) -> dict:
    """Bulk update multiple transactions and optionally create a rule."""
    with get_conn() as conn:
        # Update all specified transactions
        placeholders = ",".join("?" * len(transaction_ids))
        conn.execute(
            f"""
            UPDATE transactions
            SET category_id = ?, subcategory_id = ?, is_uncertain = 0
            WHERE id IN ({placeholders})
            """,
            [category_id, subcategory_id] + transaction_ids,
        )
        
        updated_count = conn.execute("SELECT changes()").fetchone()[0]
        
        # Optionally create a rule for future transactions
        rule_id = None
        if create_rule and rule_pattern:
            # Check if rule already exists
            existing = conn.execute(
                "SELECT id FROM rules WHERE pattern = ?",
                (rule_pattern,),
            ).fetchone()
            
            if not existing:
                cursor = conn.execute(
                    """
                    INSERT INTO rules (name, pattern, category_id, subcategory_id, priority, active)
                    VALUES (?, ?, ?, ?, 70, 1)
                    """,
                    (rule_name or f"User rule: {rule_pattern[:30]}", rule_pattern, category_id, subcategory_id),
                )
                rule_id = cursor.lastrowid
        
        conn.commit()
        
    return {
        "status": "ok",
        "updated_count": updated_count,
        "rule_id": rule_id,
    }


@app.get("/reports/summary")
def report_summary(start_date: Optional[str] = None, end_date: Optional[str] = None) -> dict:
    clauses = ["l.id IS NULL"]
    params: List[object] = []
    if start_date:
        clauses.append("t.posted_at >= ?")
        params.append(start_date)
    if end_date:
        clauses.append("t.posted_at <= ?")
        params.append(end_date)
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
    return {"items": [dict(row) for row in rows]}


@app.get("/reports/timeseries")
def report_timeseries(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    granularity: str = "day",  # day, week, month
) -> dict:
    """Get time-series data for expenses and income."""
    from datetime import datetime, timedelta
    
    # Default to last 30 days if no dates provided
    if not end_date:
        end_date = datetime.now().strftime("%Y-%m-%d")
    if not start_date:
        start_dt = datetime.strptime(end_date, "%Y-%m-%d") - timedelta(days=30)
        start_date = start_dt.strftime("%Y-%m-%d")
    
    # Determine grouping based on granularity
    if granularity == "month":
        date_format = "%Y-%m"
        date_trunc = "substr(t.posted_at, 1, 7)"
    elif granularity == "week":
        date_format = "%Y-%W"
        date_trunc = "strftime('%Y-%W', t.posted_at)"
    else:  # day
        date_format = "%Y-%m-%d"
        date_trunc = "date(t.posted_at)"
    
    query = f"""
        SELECT 
            {date_trunc} as period,
            SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END) as expenses,
            SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END) as income,
            COUNT(*) as transaction_count
        FROM transactions t
        LEFT JOIN categories c ON c.id = t.category_id
        LEFT JOIN transaction_links l
          ON (l.source_transaction_id = t.id OR l.target_transaction_id = t.id)
         AND l.link_type = 'card_payment'
        WHERE t.posted_at >= ? 
          AND t.posted_at <= ?
          AND l.id IS NULL
          AND (c.name IS NULL OR c.name != 'Transfers')
        GROUP BY {date_trunc}
        ORDER BY period ASC
    """
    
    with get_conn() as conn:
        rows = conn.execute(query, (start_date, end_date + " 23:59:59")).fetchall()
    
    return {
        "data": [dict(row) for row in rows],
        "start_date": start_date,
        "end_date": end_date,
        "granularity": granularity,
    }


@app.get("/reports/category-trend")
def report_category_trend(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    category_id: Optional[int] = None,
) -> dict:
    """Get spending trend by category over time."""
    from datetime import datetime, timedelta
    
    if not end_date:
        end_date = datetime.now().strftime("%Y-%m-%d")
    if not start_date:
        start_dt = datetime.strptime(end_date, "%Y-%m-%d") - timedelta(days=90)
        start_date = start_dt.strftime("%Y-%m-%d")
    
    clauses = ["t.posted_at >= ?", "t.posted_at <= ?", "l.id IS NULL", "t.amount < 0"]
    params: List[object] = [start_date, end_date + " 23:59:59"]
    
    if category_id:
        clauses.append("t.category_id = ?")
        params.append(category_id)
    
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
def report_stats(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> dict:
    """Get overall statistics for the date range."""
    from datetime import datetime, timedelta
    
    if not end_date:
        end_date = datetime.now().strftime("%Y-%m-%d")
    if not start_date:
        start_dt = datetime.strptime(end_date, "%Y-%m-%d") - timedelta(days=30)
        start_date = start_dt.strftime("%Y-%m-%d")
    
    with get_conn() as conn:
        # Get totals excluding transfers
        totals = conn.execute(
            """
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
            WHERE t.posted_at >= ? 
              AND t.posted_at <= ?
              AND l.id IS NULL
              AND (c.name IS NULL OR c.name != 'Transfers')
            """,
            (start_date, end_date + " 23:59:59"),
        ).fetchone()
        
        # Get top spending categories
        top_categories = conn.execute(
            """
            SELECT c.name, ABS(SUM(t.amount)) as total
            FROM transactions t
            JOIN categories c ON c.id = t.category_id
            LEFT JOIN transaction_links l
              ON (l.source_transaction_id = t.id OR l.target_transaction_id = t.id)
             AND l.link_type = 'card_payment'
            WHERE t.posted_at >= ? 
              AND t.posted_at <= ?
              AND t.amount < 0
              AND l.id IS NULL
              AND c.name != 'Transfers'
            GROUP BY c.id, c.name
            ORDER BY total DESC
            LIMIT 5
            """,
            (start_date, end_date + " 23:59:59"),
        ).fetchall()
        
        # Get date range bounds
        date_bounds = conn.execute(
            "SELECT MIN(posted_at) as min_date, MAX(posted_at) as max_date FROM transactions"
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
        "data_min_date": date_bounds["min_date"][:10] if date_bounds["min_date"] else None,
        "data_max_date": date_bounds["max_date"][:10] if date_bounds["max_date"] else None,
    }


@app.get("/reports/category/{category_id}")
def report_category_detail(
    category_id: int,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> dict:
    """Get detailed breakdown for a specific category."""
    from datetime import datetime, timedelta
    
    if not end_date:
        end_date = datetime.now().strftime("%Y-%m-%d")
    if not start_date:
        start_dt = datetime.strptime(end_date, "%Y-%m-%d") - timedelta(days=30)
        start_date = start_dt.strftime("%Y-%m-%d")
    
    with get_conn() as conn:
        # Get category info
        category = conn.execute(
            "SELECT id, name FROM categories WHERE id = ?", (category_id,)
        ).fetchone()
        
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        
        # Get subcategory breakdown
        subcategories = conn.execute(
            """
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
            WHERE t.category_id = ?
              AND t.posted_at >= ?
              AND t.posted_at <= ?
              AND t.amount < 0
              AND l.id IS NULL
            GROUP BY s.id, s.name
            ORDER BY total DESC
            """,
            (category_id, start_date, end_date + " 23:59:59"),
        ).fetchall()
        
        # Get time series for this category
        timeseries = conn.execute(
            """
            SELECT 
                date(t.posted_at) as period,
                ABS(SUM(t.amount)) as amount,
                COUNT(*) as count
            FROM transactions t
            LEFT JOIN transaction_links l
              ON (l.source_transaction_id = t.id OR l.target_transaction_id = t.id)
             AND l.link_type = 'card_payment'
            WHERE t.category_id = ?
              AND t.posted_at >= ?
              AND t.posted_at <= ?
              AND t.amount < 0
              AND l.id IS NULL
            GROUP BY date(t.posted_at)
            ORDER BY period ASC
            """,
            (category_id, start_date, end_date + " 23:59:59"),
        ).fetchall()
        
        # Get total for this category
        total = conn.execute(
            """
            SELECT 
                ABS(SUM(t.amount)) as total,
                COUNT(*) as count,
                AVG(ABS(t.amount)) as avg
            FROM transactions t
            LEFT JOIN transaction_links l
              ON (l.source_transaction_id = t.id OR l.target_transaction_id = t.id)
             AND l.link_type = 'card_payment'
            WHERE t.category_id = ?
              AND t.posted_at >= ?
              AND t.posted_at <= ?
              AND t.amount < 0
              AND l.id IS NULL
            """,
            (category_id, start_date, end_date + " 23:59:59"),
        ).fetchone()
        
        # Get recent transactions
        transactions = conn.execute(
            """
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
            WHERE t.category_id = ?
              AND t.posted_at >= ?
              AND t.posted_at <= ?
              AND t.amount < 0
              AND l.id IS NULL
            ORDER BY t.posted_at DESC
            LIMIT 50
            """,
            (category_id, start_date, end_date + " 23:59:59"),
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
def get_transaction_links(transaction_id: int) -> dict:
    """Get all links for a transaction."""
    with get_conn() as conn:
        # Check if transaction exists
        tx = conn.execute(
            "SELECT id, amount, description_raw, posted_at FROM transactions WHERE id = ?",
            (transaction_id,)
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
            WHERE l.source_transaction_id = ? OR l.target_transaction_id = ?
            """,
            (transaction_id, transaction_id, transaction_id, transaction_id, transaction_id, transaction_id, transaction_id),
        ).fetchall()
        
    return {
        "transaction": dict(tx),
        "links": [dict(row) for row in links],
    }


@app.get("/transactions/{transaction_id}/linkable")
def get_linkable_transactions(transaction_id: int) -> dict:
    """Find transactions that could be linked to this one (e.g., matching CC payment to bank debit)."""
    with get_conn() as conn:
        tx = conn.execute(
            """
            SELECT t.id, t.amount, t.description_raw, t.posted_at, t.account_id, a.type as account_type
            FROM transactions t
            JOIN accounts a ON a.id = t.account_id
            WHERE t.id = ?
            """,
            (transaction_id,)
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
        min_amount = amount * 0.95
        max_amount = amount * 1.05
        
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
              AND t.amount * ? < 0  -- Opposite sign
              AND ABS(t.amount) BETWEEN ? AND ?  -- Similar amount
              AND date(t.posted_at) BETWEEN date(?, '-7 days') AND date(?, '+7 days')  -- Within 7 days
              AND l1.id IS NULL AND l2.id IS NULL  -- Not already linked
              AND a.type != ?  -- Different account type
            ORDER BY amount_diff ASC, ABS(julianday(t.posted_at) - julianday(?)) ASC
            LIMIT 20
            """,
            (amount, transaction_id, tx["amount"], min_amount, max_amount, 
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
) -> dict:
    """Create a link between two transactions."""
    if source_id == target_id:
        raise HTTPException(status_code=400, detail="Cannot link a transaction to itself")
    
    with get_conn() as conn:
        # Verify both transactions exist
        source = conn.execute("SELECT id, amount FROM transactions WHERE id = ?", (source_id,)).fetchone()
        target = conn.execute("SELECT id, amount FROM transactions WHERE id = ?", (target_id,)).fetchone()
        
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
                "SELECT id FROM categories WHERE name = 'Transfers'"
            ).fetchone()
            cc_payment_sub = None
            if transfers_cat:
                cc_payment_sub = conn.execute(
                    "SELECT id FROM subcategories WHERE category_id = ? AND name = 'Credit Card Payment'",
                    (transfers_cat["id"],)
                ).fetchone()
            
            if transfers_cat and cc_payment_sub:
                conn.execute(
                    "UPDATE transactions SET category_id = ?, subcategory_id = ?, is_uncertain = 0 WHERE id IN (?, ?)",
                    (transfers_cat["id"], cc_payment_sub["id"], source_id, target_id),
                )
        
        conn.commit()
        
    return {"status": "ok", "link_id": link_id}


@app.delete("/transactions/link/{link_id}")
def delete_transaction_link(link_id: int) -> dict:
    """Delete a transaction link."""
    with get_conn() as conn:
        link = conn.execute("SELECT id FROM transaction_links WHERE id = ?", (link_id,)).fetchone()
        if not link:
            raise HTTPException(status_code=404, detail="Link not found")
        
        conn.execute("DELETE FROM transaction_links WHERE id = ?", (link_id,))
        conn.commit()
        
    return {"status": "ok"}


@app.get("/transactions/unlinked-payments")
def get_unlinked_payments() -> dict:
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
              AND (
                UPPER(t.description_raw) LIKE '%CREDIT CARD%'
                OR UPPER(t.description_raw) LIKE '%CC %'
                OR UPPER(t.description_raw) LIKE '%AUTOPAY%'
                OR UPPER(t.description_raw) LIKE '%CARD BILL%'
                OR UPPER(t.description_raw) LIKE '%HDFC CARD%'
                OR UPPER(t.description_raw) LIKE '%ICICI CARD%'
                OR UPPER(t.description_raw) LIKE '%SBI CARD%'
                OR UPPER(t.description_raw) LIKE '%AMEX%'
              )
            ORDER BY t.posted_at DESC
            LIMIT 50
            """,
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
              AND (
                UPPER(t.description_raw) LIKE '%PAYMENT%'
                OR UPPER(t.description_raw) LIKE '%THANK YOU%'
                OR UPPER(t.description_raw) LIKE '%RECEIVED%'
              )
            ORDER BY t.posted_at DESC
            LIMIT 50
            """,
        ).fetchall()
        
    return {
        "bank_payments": [dict(row) for row in bank_payments],
        "cc_receipts": [dict(row) for row in cc_receipts],
    }


from app.linking import find_potential_transfers, auto_categorize_linked_transfers


@app.get("/transfers/potential")
def get_potential_transfers(days_window: int = 7) -> dict:
    """
    Find potential internal transfers that aren't already linked.
    Returns pairs of transactions that may be transfers between accounts.
    """
    with get_conn() as conn:
        potential = find_potential_transfers(conn, days_window)
    return {"potential_transfers": potential, "count": len(potential)}


@app.post("/transfers/auto-link")
def auto_link_transfers() -> dict:
    """
    Automatically link high-confidence transfers and categorize them.
    Returns count of transactions linked.
    """
    with get_conn() as conn:
        # Find potential transfers with high confidence
        potential = find_potential_transfers(conn, days_window=5)
        
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
        categorized = auto_categorize_linked_transfers(conn)
    
    return {
        "linked": linked_count,
        "categorized": categorized,
        "status": "ok"
    }


@app.post("/transfers/link")
def link_transfer(source_id: int, target_id: int) -> dict:
    """Manually link two transactions as an internal transfer."""
    with get_conn() as conn:
        # Verify both transactions exist
        source = conn.execute("SELECT id FROM transactions WHERE id = ?", (source_id,)).fetchone()
        target = conn.execute("SELECT id FROM transactions WHERE id = ?", (target_id,)).fetchone()
        
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
        categorized = auto_categorize_linked_transfers(conn)
    
    return {"status": "ok", "categorized": categorized}
