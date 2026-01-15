import csv
import io
from typing import Optional, Tuple

from app.ingest.normalize import compute_hash, normalize_amount, normalize_description, parse_amount, parse_date
from app.ingest.profiles import resolve_profile


def _get_amount(row: dict, mapping: dict) -> float:
    """Extract and parse amount from row, handling debit/credit columns."""
    if mapping.get("amount") and row.get(mapping["amount"]):
        return parse_amount(row[mapping["amount"]])
    
    debit = row.get(mapping.get("debit", "")) if mapping.get("debit") else None
    credit = row.get(mapping.get("credit", "")) if mapping.get("credit") else None
    
    if debit and str(debit).strip():
        return -abs(parse_amount(debit))
    if credit and str(credit).strip():
        return abs(parse_amount(credit))
    return 0.0


def ingest_csv(
    conn,
    account_id: int,
    statement_id: int,
    payload: bytes,
    profile: Optional[str],
) -> Tuple[int, int]:
    mapping = resolve_profile(profile)
    decoded = payload.decode("utf-8", errors="ignore")
    reader = csv.DictReader(io.StringIO(decoded))
    inserted = 0
    skipped = 0
    for row in reader:
        if not row:
            continue
        posted_at = parse_date(row.get(mapping["date"], ""))
        if not posted_at:
            skipped += 1
            continue
        description_raw = row.get(mapping["description"], "") or ""
        description_norm = normalize_description(description_raw)
        amount = _get_amount(row, mapping)
        currency = row.get(mapping.get("currency", ""), "INR") or "INR"
        tx_hash = compute_hash(account_id, posted_at, amount, description_norm)

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
                    normalize_amount(amount),
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
