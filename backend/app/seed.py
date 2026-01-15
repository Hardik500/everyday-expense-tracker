from pathlib import Path

from app.db import get_conn
from app.ingest.csv import ingest_csv
from app.ingest.ofx import ingest_ofx
from app.ingest.pdf import ingest_pdf
from app.ingest.xls import ingest_xls
from app.linking import link_card_payments
from app.rules.engine import apply_rules
from app.rules.seed_rules import SEED_CATEGORIES, SEED_RULES


def seed_categories_and_rules() -> None:
    with get_conn() as conn:
        existing = conn.execute("SELECT COUNT(1) as total FROM categories").fetchone()
        if existing and existing["total"] > 0:
            return

        category_ids = {}
        for category_name, subcats in SEED_CATEGORIES.items():
            cursor = conn.execute(
                "INSERT INTO categories (name, is_system) VALUES (?, 1)",
                (category_name,),
            )
            category_id = cursor.lastrowid
            category_ids[category_name] = category_id
            for subcat in subcats:
                conn.execute(
                    "INSERT INTO subcategories (category_id, name) VALUES (?, ?)",
                    (category_id, subcat),
                )

        for rule in SEED_RULES:
            category_id = category_ids[rule["category"]]
            subcategory_id = conn.execute(
                """
                SELECT id FROM subcategories
                WHERE category_id = ? AND name = ?
                """,
                (category_id, rule["subcategory"]),
            ).fetchone()["id"]
            conn.execute(
                """
                INSERT INTO rules (name, pattern, category_id, subcategory_id, priority)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    rule["name"],
                    rule["pattern"],
                    category_id,
                    subcategory_id,
                    rule["priority"],
                ),
            )
        conn.commit()


def seed_statements_from_dir(statements_dir: Path, account_id: int = 1) -> None:
    if not statements_dir.exists():
        return

    with get_conn() as conn:
        existing = conn.execute(
            "SELECT id FROM accounts WHERE id = ?",
            (account_id,),
        ).fetchone()
        if not existing:
            conn.execute(
                "INSERT INTO accounts (id, name, type, currency) VALUES (?, ?, ?, ?)",
                (account_id, "Seeded Account", "bank", "INR"),
            )
            conn.commit()

    for path in statements_dir.iterdir():
        if not path.is_file():
            continue
        suffix = path.suffix.lower()
        if suffix not in {".csv", ".ofx", ".qfx", ".xls", ".xlsx", ".pdf"}:
            continue

        source = "csv"
        if suffix in {".ofx", ".qfx"}:
            source = "ofx"
        elif suffix in {".xls", ".xlsx"}:
            source = "xls"
        elif suffix == ".pdf":
            source = "pdf"

        with get_conn() as conn:
            statement_id = conn.execute(
                "INSERT INTO statements (account_id, source, file_name) VALUES (?, ?, ?)",
                (account_id, source, path.name),
            ).lastrowid
            conn.commit()

            payload = path.read_bytes()
            if source == "csv":
                ingest_csv(conn, account_id, statement_id, payload, profile="generic")
            elif source == "xls":
                ingest_xls(conn, account_id, statement_id, payload, profile="generic")
            elif source == "pdf":
                ingest_pdf(conn, account_id, statement_id, payload)
            else:
                ingest_ofx(conn, account_id, statement_id, payload)

            apply_rules(conn, account_id=account_id, statement_id=statement_id)
            link_card_payments(conn, account_id=account_id)
            conn.commit()
