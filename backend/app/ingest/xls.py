from typing import Optional, Tuple
import io

import pandas as pd

from app.ingest.normalize import (
    compute_hash,
    normalize_amount,
    normalize_description,
    parse_amount,
    parse_date,
)
from app.ingest.profiles import resolve_profile, detect_profile


def _is_duplicate_error(e: Exception) -> bool:
    """Check if exception is a duplicate/unique constraint violation."""
    error_msg = str(e)
    # SQLite uses "UNIQUE constraint failed"
    # PostgreSQL uses "duplicate key value violates unique constraint"
    return "UNIQUE" in error_msg.upper() or "duplicate" in error_msg.lower()


def _find_header_row(df: pd.DataFrame) -> int:
    """
    Find the row containing column headers in a bank statement.
    Bank statements often have letterhead/address info at the top.
    
    We look for a row where the first column is exactly "Date" (case-insensitive)
    or matches common date column patterns.
    """
    date_exact_matches = ["date", "txn date", "transaction date", "tran date", "posting date"]
    
    for idx, row in df.iterrows():
        first_val = str(row.iloc[0]).lower().strip() if pd.notna(row.iloc[0]) else ''
        
        # Check if first column matches a date header exactly
        if first_val in date_exact_matches:
            return idx
        
        # Also check if any column in this row looks like a date header
        # AND the row has multiple non-empty values (indicating a header row)
        non_empty_count = sum(1 for v in row.values if pd.notna(v) and str(v).strip())
        if non_empty_count >= 3:  # Header rows typically have multiple columns
            row_values = [str(v).lower().strip() for v in row.values if pd.notna(v)]
            if any(v in date_exact_matches for v in row_values):
                return idx
    
    return 0  # Default to first row


def _clean_dataframe(df: pd.DataFrame, header_row: int) -> pd.DataFrame:
    """Re-read the dataframe with the correct header row."""
    # Get new column names from header row
    new_columns = df.iloc[header_row].values
    # Create new dataframe starting from row after header
    new_df = df.iloc[header_row + 1:].copy()
    new_df.columns = new_columns
    new_df = new_df.reset_index(drop=True)
    
    # Clean up - skip any rows that look like separators (all asterisks, dashes, etc.)
    mask = new_df.iloc[:, 0].apply(
        lambda x: pd.notna(x) and str(x).strip() and not str(x).strip().startswith('*')
    )
    new_df = new_df[mask].reset_index(drop=True)
    
    return new_df


def ingest_xls(
    conn,
    account_id: int,
    statement_id: int,
    payload: bytes,
    profile: Optional[str],
    user_id: int,
) -> Tuple[int, int, int]:
    # First read without header to find the actual header row
    df_raw = pd.read_excel(io.BytesIO(payload), header=None)
    header_row = _find_header_row(df_raw)
    
    # Re-read with correct header
    if header_row > 0:
        df = _clean_dataframe(df_raw, header_row)
    else:
        df = pd.read_excel(io.BytesIO(payload))
    
    # Get column list and auto-detect mapping
    columns = [str(c) for c in df.columns.tolist()]
    mapping = detect_profile(columns)
    
    # If auto-detection didn't find date column, fall back to profile
    if "date" not in mapping:
        profile_mapping = resolve_profile(profile)
        for key in profile_mapping:
            if key not in mapping:
                mapping[key] = profile_mapping[key]
    
    inserted = 0
    skipped = 0

    for _, row in df.iterrows():
        # Get date
        date_col = mapping.get("date", "Date")
        date_val = row.get(date_col, "")
        posted_at = parse_date(str(date_val)) if pd.notna(date_val) else None
        
        if not posted_at:
            skipped += 1
            continue
        
        # Get description
        desc_col = mapping.get("description", "Narration")
        description_raw = str(row.get(desc_col, "") or "")
        description_norm = normalize_description(description_raw)
        
        if not description_norm:
            skipped += 1
            continue
        
        # Get amount - handle separate debit/credit columns or single amount column
        amount = 0.0
        amount_col = mapping.get("amount")
        debit_col = mapping.get("debit")
        credit_col = mapping.get("credit")
        
        if amount_col:
            amount_val = row.get(amount_col)
            if pd.notna(amount_val) and str(amount_val).strip():
                amount = parse_amount(amount_val)
        
        if amount == 0.0 and (debit_col or credit_col):
            debit_val = row.get(debit_col) if debit_col else None
            credit_val = row.get(credit_col) if credit_col else None
            
            # Check debit first (withdrawal = negative amount)
            if debit_val is not None and pd.notna(debit_val):
                debit_parsed = parse_amount(debit_val)
                if debit_parsed != 0.0:
                    amount = -abs(debit_parsed)
            
            # Then check credit (deposit = positive amount)
            if amount == 0.0 and credit_val is not None and pd.notna(credit_val):
                credit_parsed = parse_amount(credit_val)
                if credit_parsed != 0.0:
                    amount = abs(credit_parsed)
        
        if amount == 0.0:
            skipped += 1
            continue
        
        currency = "INR"
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
            if _is_duplicate_error(e):
                print(f"  -> Duplicate transaction (hash already exists)")
            else:
                skipped += 1

    # Return inserted, skipped, duplicates (duplicates not counted in skipped)
    return inserted, skipped, 0  # Return 0 for duplicates as XLS parsing doesn't have same issue
