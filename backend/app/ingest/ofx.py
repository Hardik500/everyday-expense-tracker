import io
from typing import Tuple

from ofxparse import OfxParser

from app.ingest.normalize import compute_hash, normalize_amount, normalize_description


def ingest_ofx(
    conn, account_id: int, statement_id: int, payload: bytes, user_id: int
) -> Tuple[int, int, int]:
    inserted = 0
    skipped = 0
    duplicates = 0
    ofx = OfxParser.parse(io.BytesIO(payload))
    currency = ofx.account.statement.currency or "INR"
    for tx in ofx.account.statement.transactions:
        posted_at = tx.date.date().isoformat()
        description_raw = tx.payee or tx.memo or ""
        description_norm = normalize_description(description_raw)
        amount = float(tx.amount)
        tx_hash = compute_hash(posted_at, amount, description_norm, user_id=user_id)
        try:
            conn.execute(
                """
                INSERT INTO transactions (
                    account_id, statement_id, posted_at, amount, currency,
                    description_raw, description_norm, hash, user_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    account_id,
                    statement_id,
                    posted_at,
                    normalize_amount(amount),
                    currency,
                    description_raw,
                    description_norm,
                    tx_hash,
                    user_id,
                ),
            )
            inserted += 1
        except Exception as e:
            error_msg = str(e)
            if "UNIQUE" in error_msg.upper() or "duplicate" in error_msg.lower():
                duplicates += 1
            else:
                skipped += 1
    return inserted, skipped, duplicates
