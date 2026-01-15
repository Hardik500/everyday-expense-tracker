from typing import Optional, Tuple
import io

import pandas as pd

from app.ingest.normalize import (
    compute_hash,
    normalize_amount,
    normalize_description,
    parse_date,
)
from app.ingest.profiles import resolve_profile


def ingest_xls(
    conn,
    account_id: int,
    statement_id: int,
    payload: bytes,
    profile: Optional[str],
) -> Tuple[int, int]:
    mapping = resolve_profile(profile)
    df = pd.read_excel(io.BytesIO(payload))
    inserted = 0
    skipped = 0

    for _, row in df.iterrows():
        posted_at = parse_date(str(row.get(mapping["date"], "")))
        if not posted_at:
            skipped += 1
            continue
        description_raw = str(row.get(mapping["description"], "") or "")
        description_norm = normalize_description(description_raw)
        amount = row.get(mapping.get("amount", ""), None)
        if amount is None:
            debit = row.get(mapping.get("debit", ""), None)
            credit = row.get(mapping.get("credit", ""), None)
            if debit:
                amount = -abs(float(debit))
            elif credit:
                amount = abs(float(credit))
            else:
                amount = 0.0
        currency = row.get(mapping.get("currency", ""), "INR") or "INR"
        tx_hash = compute_hash(account_id, posted_at, float(amount), description_norm)

        try:
            conn.execute(
                """
                INSERT INTO transactions (
                    account_id, statement_id, posted_at, amount, currency,
                    description_raw, description_norm, hash
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    account_id,
                    statement_id,
                    posted_at,
                    normalize_amount(float(amount)),
                    currency,
                    description_raw,
                    description_norm,
                    tx_hash,
                ),
            )
            inserted += 1
        except Exception:
            skipped += 1
    return inserted, skipped
