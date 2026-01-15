import csv
import io
from typing import Optional, Tuple

from app.ingest.normalize import compute_hash, normalize_amount, normalize_description, parse_amount, parse_date
from app.ingest.profiles import resolve_profile


def _get_amount(row: dict, mapping: dict) -> float:
    """Extract and parse amount from row, handling debit/credit columns."""
    if mapping.get("amount") and row.get(mapping["amount"]):
        return parse_amount(row[mapping["amount"]])
    
    debit_col = mapping.get("debit", "")
    credit_col = mapping.get("credit", "")
    
    debit_val = row.get(debit_col, "") if debit_col else ""
    credit_val = row.get(credit_col, "") if credit_col else ""
    
    # Parse both amounts
    debit_amount = parse_amount(debit_val) if debit_val and str(debit_val).strip() else 0.0
    credit_amount = parse_amount(credit_val) if credit_val and str(credit_val).strip() else 0.0
    
    # Return the non-zero amount (debit as negative, credit as positive)
    if debit_amount > 0:
        return -abs(debit_amount)
    if credit_amount > 0:
        return abs(credit_amount)
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
    
    # Skip empty lines at the beginning and strip whitespace from content
    lines = decoded.splitlines()
    cleaned_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped:  # Skip empty lines
            cleaned_lines.append(stripped)
    
    if not cleaned_lines:
        return 0, 0
    
    # Clean up column names - strip whitespace
    reader = csv.DictReader(io.StringIO('\n'.join(cleaned_lines)))
    # Create mapping with stripped keys
    fieldnames = reader.fieldnames or []
    clean_fieldnames = [f.strip() for f in fieldnames]
    
    inserted = 0
    skipped = 0
    for row in reader:
        # Strip keys in the row
        row = {k.strip(): v for k, v in row.items() if k}
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
