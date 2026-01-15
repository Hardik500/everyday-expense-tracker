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
            SELECT id, name, pattern, category_id, subcategory_id, min_amount,
                   max_amount, priority, account_type, merchant_contains, active
            FROM rules
            ORDER BY priority DESC, name
            """
        ).fetchall()
    return [dict(row) for row in rows]


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
