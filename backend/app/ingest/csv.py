import csv
import io
import re
from typing import Optional, Tuple, Dict, List

from app.ingest.normalize import compute_hash, normalize_amount, normalize_description, parse_amount, parse_date
from app.ingest.profiles import resolve_profile, detect_profile


def _detect_delimiter(content: str) -> str:
    """Detect delimiter using csv.Sniffer or fallback."""
    try:
        # Take a sample of lines
        sample = '\n'.join(content.splitlines()[:20])
        dialect = csv.Sniffer().sniff(sample, delimiters=',\t|;')
        return dialect.delimiter
    except csv.Error:
        # Fallback manual counting
        lines = content.splitlines()[:20]
        delimiters = {',': 0, '\t': 0, '|': 0, ';': 0}
        for line in lines:
            for d in delimiters:
                delimiters[d] += line.count(d)
        best = max(delimiters, key=delimiters.get)
        return best if delimiters[best] >= 5 else ','


def _find_header_index(lines: List[str], delimiter: str) -> int:
    """Find the index of the header row based on common keywords."""
    for i, line in enumerate(lines[:30]): # Check first 30 lines
        # Split by delimiter
        if delimiter not in line:
            continue
            
        parts = [p.strip().lower() for p in line.split(delimiter)]
        
        # Check for critical column names
        # Must have Date AND (Amount OR Debit OR Credit OR Description)
        has_date = any('date' in p for p in parts)
        has_money = any(x in p for p in parts for x in ['amount', 'debit', 'credit', 'bal', 'value'])
        has_desc = any(x in p for p in parts for x in ['desc', 'narration', 'particulars', 'remarks'])
        
        if has_date and (has_money or has_desc):
            return i
            
    return 0


def _auto_map_columns(fieldnames: List[str]) -> Dict[str, str]:
    """Automatically map CSV headers to standard fields using profile detection."""
    # Use the enhanced detect_profile from profiles module
    mapping = detect_profile(fieldnames)

    # If we still don't have a date column, try additional patterns
    if 'date' not in mapping:
        normalized = {f: f.lower().strip() for f in fieldnames}

        # Try date-related patterns
        date_patterns = [
            'date', 'txn date', 'transaction date', 'trans date',
            'posting date', 'value date', 'posted at', 'posted_at'
        ]
        for f, f_norm in normalized.items():
            for pattern in date_patterns:
                if pattern in f_norm:
                    mapping['date'] = f
                    break
            if 'date' in mapping:
                break

    # If still no description, try more patterns
    if 'description' not in mapping:
        normalized = {f: f.lower().strip() for f in fieldnames}
        desc_patterns = [
            'narration', 'description', 'particulars', 'remarks',
            'details', 'transaction details', 'transaction remarks',
            'merchant', 'vendor', 'description'
        ]
        for f, f_norm in normalized.items():
            for pattern in desc_patterns:
                if pattern in f_norm:
                    mapping['description'] = f
                    break
            if 'description' in mapping:
                break

    # Enhanced debit/credit detection
    if 'debit' not in mapping and 'credit' not in mapping:
        normalized = {f: f.lower().strip() for f in fieldnames}

        # Look for debit patterns
        debit_patterns = ['debit', 'dr', 'withdrawal', 'withdraw', 'amount dr']
        for f, f_norm in normalized.items():
            for pattern in debit_patterns:
                if pattern in f_norm:
                    mapping['debit'] = f
                    break
            if 'debit' in mapping:
                break

        # Look for credit patterns
        credit_patterns = ['credit', 'cr', 'deposit', 'dep', 'amount cr']
        for f, f_norm in normalized.items():
            for pattern in credit_patterns:
                if pattern in f_norm:
                    mapping['credit'] = f
                    break
            if 'credit' in mapping:
                break

    # Single amount column (only if we don't have split debit/credit)
    if 'debit' not in mapping and 'credit' not in mapping:
        normalized = {f: f.lower().strip() for f in fieldnames}
        amount_patterns = ['amount', 'amt', 'value', 'total amount']
        for f, f_norm in normalized.items():
            for pattern in amount_patterns:
                if pattern in f_norm:
                    mapping['amount'] = f
                    break
            if 'amount' in mapping:
                break

    return mapping


def _get_amount(row: dict, mapping: dict) -> float:
    """Extract amount using mapping."""
    # Split Debit/Credit
    debit_col = mapping.get('debit')
    credit_col = mapping.get('credit')

    if debit_col and credit_col:
        debit_val = parse_amount(row.get(debit_col))
        credit_val = parse_amount(row.get(credit_col))

        # If both are non-zero? Usually one is 0.
        if debit_val > 0:
            return -debit_val
        if credit_val > 0:
            return credit_val
        return 0.0

    if debit_col:  # Only debit column found? unlikely.
        # Logic implies split columns usually come together.
        pass

    # Single Amount Column
    amount_col = mapping.get('amount')
    if amount_col:
        val = parse_amount(row.get(amount_col))
        # Logic to determine sign?
        # Usually single amount column implies sign is in value (-100 vs 100) OR separate "Type" column (Cr/Dr).
        # Auto-mapper handles split columns best.
        # If headers contain "Debit Amount" and "Credit Amount" (like user sample), we use split logic.
        return val

    return 0.0


def _parse_unstructured_csv_row(row_values: List[str]) -> Optional[Tuple[str, str, float, bool]]:
    """
    Parse a row of CSV data without headers by detecting patterns.
    Returns (date, description, amount, is_credit) if a transaction is found.
    """
    if not row_values:
        return None

    # Clean values
    values = [str(v).strip() for v in row_values if v]
    if not values:
        return None

    # Look for amount pattern in values
    amount_pattern = re.compile(r'^-?([0-9,]+\.\d{2})\s*(Dr|Cr|DR|CR)?$', re.IGNORECASE)

    for i, val in enumerate(values):
        match = amount_pattern.match(val)
        if match:
            amount = parse_amount(match.group(1))
            drcr = match.group(2)
            is_credit = drcr and drcr.lower() == 'cr'

            if amount == 0:
                continue

            # Description is usually the non-numeric, non-date values
            description_parts = []
            date_parts = []

            for j, v in enumerate(values):
                if j == i:
                    continue  # Skip the amount field
                # Try to detect if this is a date
                if re.match(r'^\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}$', v):
                    date_parts.append(v)
                elif re.match(r'^\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4}$', v):
                    date_parts.append(v)
                else:
                    description_parts.append(v)

            description = ' '.join(description_parts) if description_parts else 'Transaction'

            if not description or len(description) < 2:
                continue

            # Try to parse a date from date parts
            date_str = None
            for dp in date_parts:
                parsed = parse_date(dp)
                if parsed:
                    date_str = parsed
                    break

            if not date_str:
                # Try to find date in any value
                for v in values:
                    parsed = parse_date(v)
                    if parsed:
                        date_str = parsed
                        break

            if date_str:
                return (date_str, description, amount, is_credit)

    return None


def ingest_csv(
    conn,
    account_id: int,
    statement_id: int,
    payload: bytes,
    profile: Optional[str],
    user_id: int,
) -> Tuple[int, int]:
    # Decode
    try:
        decoded = payload.decode("utf-8")
    except UnicodeDecodeError:
        decoded = payload.decode("latin-1", errors="ignore")
        
    delimiter = _detect_delimiter(decoded)
    
    # Pre-process lines (skip empty)
    lines = [line.strip() for line in decoded.splitlines() if line.strip()]
    
    # Locate header row using keywords (robust against preamble)
    header_idx = _find_header_index(lines, delimiter)
    if header_idx > 0:
        lines = lines[header_idx:]

    if not lines:
        return 0, 0
            
    # Parse
    # skipinitialspace=True is crucial for "Date ,Narration" type headers
    reader = csv.DictReader(lines, delimiter=delimiter, skipinitialspace=True)
    raw_fieldnames = reader.fieldnames or []
    # FIX: Clean fieldnames to match row key cleaning
    fieldnames = [f.strip() for f in raw_fieldnames if f]
    
    # Determine Mapping
    if profile:
        mapping = resolve_profile(profile)
    else:
        mapping = _auto_map_columns(fieldnames)
        
    # Check if we have minimum requirements
    if not mapping.get('date'):
        print(f"Auto-mapping failed: No date column found in {fieldnames}")
        return 0, 0
        
    if not (mapping.get('amount') or (mapping.get('debit') and mapping.get('credit'))):
        print(f"Auto-mapping failed: No amount/debit+credit columns found in {fieldnames}")
        return 0, 0

    inserted = 0
    skipped = 0
    
    for row in reader:
        # Clean row keys/values - this matches the stripped fieldnames
        row = {k.strip(): v for k, v in row.items() if k}
        
        # Extract Date
        date_col = mapping['date']
        posted_at = parse_date(row.get(date_col))
        if not posted_at:
            skipped += 1
            continue
            
        # Extract Description
        desc_col = mapping.get('description')
        description_raw = row.get(desc_col, "Transaction") if desc_col else "Transaction"
        description_norm = normalize_description(description_raw)
        
        # Extract Amount
        amount = _get_amount(row, mapping)
        if amount == 0:
            skipped += 1
            continue

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
                    amount,
                    "INR",
                    description_raw,
                    description_norm,
                    tx_hash,
                    user_id,
                ),
            )
            inserted += 1
        except Exception:
            skipped += 1

    # Fallback: If no transactions inserted and auto-mapping failed,
    # try to parse raw data (unstructured CSV)
    if inserted == 0 and profile is None:
        print("Standard CSV parsing yielded 0 results - attempting raw data parsing...")
        for line in lines:
            # Skip header-like lines
            if header_idx > 0 and lines.index(line) <= header_idx:
                continue

            # Skip empty lines and lines that look like headers
            line_lower = line.lower()
            if any(x in line_lower for x in ['date', 'description', 'narration', 'particulars', 'amount', 'total']):
                continue

            # Split by delimiter and try to parse
            row_values = [v.strip() for v in line.split(delimiter) if v.strip()]

            if len(row_values) >= 2:
                parsed = _parse_unstructured_csv_row(row_values)
                if parsed:
                    date_str, description, amount, is_credit = parsed

                    if amount == 0:
                        continue

                    description_norm = normalize_description(description)
                    tx_hash = compute_hash(date_str, amount, description_norm, user_id=user_id)

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
                                date_str,
                                amount,
                                "INR",
                                description,
                                description_norm,
                                tx_hash,
                                user_id,
                            ),
                        )
                        inserted += 1
                    except Exception:
                        skipped += 1

        if inserted > 0:
            print(f"Raw data parsing found {inserted} transactions")

    return inserted, skipped
