from datetime import datetime, timedelta
from typing import Optional


def link_card_payments(conn, account_id: Optional[int] = None) -> None:
    clauses = []
    params = []
    if account_id is not None:
        clauses.append("t.account_id = ?")
        params.append(account_id)
    where = f"AND {' AND '.join(clauses)}" if clauses else ""

    bank_payments = conn.execute(
        f"""
        SELECT t.id, t.posted_at, t.amount, t.description_norm
        FROM transactions t
        JOIN accounts a ON a.id = t.account_id
        WHERE a.type = 'bank'
          AND t.description_norm LIKE '%CARD%PAYMENT%'
          {where}
        """,
        params,
    ).fetchall()

    card_transactions = conn.execute(
        """
        SELECT t.id, t.posted_at, t.amount
        FROM transactions t
        JOIN accounts a ON a.id = t.account_id
        WHERE a.type = 'card'
        """
    ).fetchall()

    for payment in bank_payments:
        payment_date = datetime.fromisoformat(payment["posted_at"])
        window_start = (payment_date - timedelta(days=5)).date().isoformat()
        window_end = (payment_date + timedelta(days=5)).date().isoformat()
        matches = [
            tx
            for tx in card_transactions
            if window_start <= tx["posted_at"] <= window_end
            and abs(abs(tx["amount"]) - abs(payment["amount"])) < 0.01
        ]
        for match in matches:
            conn.execute(
                """
                INSERT OR IGNORE INTO transaction_links
                (source_transaction_id, target_transaction_id, link_type)
                VALUES (?, ?, 'card_payment')
                """,
                (payment["id"], match["id"]),
            )
