import csv
import io
import re
from typing import Optional, Tuple

from app.ingest.normalize import compute_hash, normalize_amount, normalize_description, parse_amount, parse_date
from app.ingest.profiles import resolve_profile


def _get_amount(row: dict, mapping: dict, is_credit: bool = False) -> float:
    """Extract and parse amount from row, handling debit/credit columns."""
    if mapping.get("amount") and row.get(mapping["amount"]):
        amt = parse_amount(row[mapping["amount"]])
        # If we have a credit indicator, make it positive; otherwise it's a debit (negative for CC)
        return abs(amt) if is_credit else -abs(amt)
    
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


def _detect_delimiter(content: str) -> str:
    """Detect delimiter used in the file."""
    # Check first few lines for common delimiters
    lines = content.splitlines()[:20]
    
    # Count delimiter occurrences
    delimiters = {',': 0, '~': 0, '\t': 0, '|': 0, ';': 0}
    for line in lines:
        for d in delimiters:
            delimiters[d] += line.count(d)
    
    # Return the most common delimiter (minimum 5 occurrences)
    best = max(delimiters, key=delimiters.get)
    return best if delimiters[best] >= 5 else ','


def _is_hdfc_cc_csv(content: str, delimiter: str) -> bool:
    """Check if this is an HDFC Credit Card CSV format."""
    # Look for characteristic HDFC CC CSV header
    if "Transaction type" in content and "Primary / Addon" in content:
        return True
    if "AMT" in content and "Debit / Credit" in content:
        return True
    return False


def _find_header_row(lines: list, delimiter: str) -> int:
    """Find the row index containing the header for HDFC CC CSV."""
    for i, line in enumerate(lines):
        if "Transaction type" in line and "DATE" in line and "Description" in line:
            return i
        if "DATE" in line and "AMT" in line:
            return i
    return 0


def ingest_csv(
    conn,
    account_id: int,
    statement_id: int,
    payload: bytes,
    profile: Optional[str],
) -> Tuple[int, int]:
    mapping = resolve_profile(profile)
    decoded = payload.decode("utf-8", errors="ignore")
    
    # Detect delimiter
    delimiter = _detect_delimiter(decoded)
    
    # Skip empty lines at the beginning and strip whitespace from content
    lines = decoded.splitlines()
    cleaned_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped:  # Skip empty lines
            cleaned_lines.append(stripped)
    
    if not cleaned_lines:
        return 0, 0
    
    # Check if this is HDFC CC CSV format
    is_hdfc_cc = _is_hdfc_cc_csv(decoded, delimiter)
    
    if is_hdfc_cc:
        return _ingest_hdfc_cc_csv(conn, account_id, statement_id, cleaned_lines, delimiter)
    
    # Standard CSV processing
    reader = csv.DictReader(io.StringIO('\n'.join(cleaned_lines)), delimiter=delimiter)
    fieldnames = reader.fieldnames or []
    
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


def _ingest_hdfc_cc_csv(
    conn,
    account_id: int,
    statement_id: int,
    lines: list,
    delimiter: str,
) -> Tuple[int, int]:
    """
    Handle HDFC Credit Card CSV format. The file may contain multiple statement sections
    with different delimiters:
    
    Old format (~ delimiter):
    Transaction type~Primary / Addon Customer Name~DATE~Description~AMT~Debit / Credit
    Domestic~NAME~12/04/2025~MERCHANT NAME~521.64~
    
    New format (~|~ delimiter):
    Transaction type~|~Primary / Addon Customer Name~|~DATE~|~Description~|~AMT~|~Debit /Credit~|~REWARD...
    Domestic~|~NAME~|~12/08/2025 00:00:00~|~MERCHANT NAME~|~521.64~|~~|~...
    """
    inserted = 0
    skipped = 0
    
    # Process line by line, detecting format changes
    current_delimiter = None
    date_idx = None
    desc_idx = None
    amt_idx = None
    credit_indicator_idx = None
    
    for line in lines:
        # Check if this is a header line
        if 'Transaction type' in line and 'DATE' in line:
            # Detect delimiter for this section
            if '~|~' in line:
                current_delimiter = '~|~'
            else:
                current_delimiter = '~'
            
            headers = [h.strip() for h in line.split(current_delimiter)]
            
            # Find column indices
            date_idx = None
            desc_idx = None
            amt_idx = None
            credit_indicator_idx = None
            
            for i, h in enumerate(headers):
                h_lower = h.lower()
                if 'date' in h_lower and date_idx is None:
                    date_idx = i
                elif 'description' in h_lower:
                    desc_idx = i
                elif 'amt' in h_lower or 'amount' in h_lower:
                    amt_idx = i
                elif 'debit' in h_lower and 'credit' in h_lower:
                    credit_indicator_idx = i
            
            continue
        
        # Skip if we haven't found a header yet
        if current_delimiter is None or date_idx is None:
            continue
        
        # Check if this is a transaction line (starts with Domestic or International)
        if not (line.startswith('Domestic') or line.startswith('International')):
            continue
        
        parts = line.split(current_delimiter)
        if len(parts) <= max(date_idx, desc_idx, amt_idx):
            skipped += 1
            continue
        
        # Parse date (may include timestamp like "12/08/2025 00:00:00")
        date_str = parts[date_idx].strip()
        # Extract just the date part if there's a timestamp
        date_match = re.match(r'(\d{2}/\d{2}/\d{4})', date_str)
        if not date_match:
            skipped += 1
            continue
        
        date_str = date_match.group(1)
        posted_at = parse_date(date_str)
        if not posted_at:
            skipped += 1
            continue
        
        description_raw = parts[desc_idx].strip() if desc_idx < len(parts) else ""
        if not description_raw:
            skipped += 1
            continue
        
        # Skip summary lines
        if any(kw in description_raw.lower() for kw in ['opening bal', 'closing bal', 'total', 'minimum amount']):
            skipped += 1
            continue
        
        description_norm = normalize_description(description_raw)
        
        # Parse amount
        amt_str = parts[amt_idx].strip() if amt_idx < len(parts) else ""
        if not amt_str:
            skipped += 1
            continue
        
        amount = parse_amount(amt_str)
        if amount == 0:
            skipped += 1
            continue
        
        # Check if this is a credit (payment received)
        is_credit = False
        if credit_indicator_idx is not None and credit_indicator_idx < len(parts):
            credit_val = parts[credit_indicator_idx].strip().lower()
            is_credit = 'cr' in credit_val
        
        # For credit cards: debits are negative (purchases), credits are positive (payments)
        if is_credit:
            amount = abs(amount)
        else:
            amount = -abs(amount)
        
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
                    "INR",
                    description_raw,
                    description_norm,
                    tx_hash,
                ),
            )
            inserted += 1
        except Exception:
            skipped += 1
    
    return inserted, skipped
