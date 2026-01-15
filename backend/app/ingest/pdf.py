import io
import re
from typing import Optional, Tuple

import pdfplumber

from app.ingest.normalize import compute_hash, normalize_description, parse_amount, parse_date


# Date patterns for different formats
DATE_PATTERN = re.compile(r"(\d{2}[/-]\d{2}[/-]\d{2,4})")
# Credit card statement pattern: DATE| TIME DESCRIPTION [+/-] [points] [C] AMOUNT [l]
CC_LINE_PATTERN = re.compile(r"(\d{2}/\d{2}/\d{4})\|?\s*(\d{2}:\d{2})?\s+(.+?)\s+[C₹]?\s*([0-9,]+\.\d{2})\s*[lL]?$")


def _detect_pdf_type(pdf) -> str:
    """Detect if PDF is a credit card statement or bank statement."""
    first_page_text = ""
    for page in pdf.pages[:2]:
        first_page_text += (page.extract_text() or "") + "\n"
    
    text_lower = first_page_text.lower()
    
    # Credit card indicators
    if "credit card" in text_lower or "card statement" in text_lower:
        return "credit_card"
    
    # Bank statement indicators
    if "savings" in text_lower or "withdrawalamt" in text_lower or "depositamt" in text_lower or "closingbalance" in text_lower:
        return "bank"
    
    # If date|time format found, likely credit card
    if "|" in first_page_text:
        return "credit_card"
    
    return "unknown"


def _parse_credit_card_line(line: str) -> Optional[Tuple[str, str, float]]:
    """Parse a credit card PDF line to extract date, description, and amount."""
    # Skip header and summary lines
    skip_patterns = ["TRANSACTIONS", "DOMESTIC", "INTERNATIONAL", "DATE", "DESCRIPTION", 
                     "REWARDS", "AMOUNT", "TOTAL", "PAYMENT", "BALANCE", "DUE", "LIMIT"]
    line_upper = line.upper()
    if any(pattern in line_upper for pattern in skip_patterns):
        if "AUTOPAY" not in line_upper and "PAYMENT" not in line_upper:
            return None
    
    # Try specific credit card format: DATE| TIME DESCRIPTION C AMOUNT l
    match = CC_LINE_PATTERN.match(line.strip())
    if match:
        date_str = match.group(1)
        description = match.group(3).strip()
        amount_str = match.group(4)
        amount = parse_amount(amount_str)
        if amount > 0:
            return date_str, description, amount
    
    # Fallback: Generic parsing
    date_match = DATE_PATTERN.search(line)
    if not date_match:
        return None
    
    date_str = date_match.group(1)
    tokens = line.split()
    if len(tokens) < 3:
        return None
    
    # Look for amount pattern (number with comma/decimal)
    amount = 0.0
    amount_token = ""
    
    # Search from the end for a valid amount
    for i in range(len(tokens) - 1, -1, -1):
        token = tokens[i]
        # Skip trailing markers like 'l', 'L', 'C'
        if token in ('l', 'L', 'C', '+', '-'):
            continue
        potential_amount = parse_amount(token)
        if potential_amount > 0:
            amount = potential_amount
            amount_token = token
            break
    
    if amount == 0.0:
        return None
    
    # Build description from remaining tokens
    description = line.replace(date_str, "").replace(amount_token, "")
    description = re.sub(r"\|?\s*\d{2}:\d{2}", "", description)  # Remove time
    description = description.strip()
    
    if not description:
        return None
    
    return date_str, description, amount


def ingest_pdf(conn, account_id: int, statement_id: int, payload: bytes) -> Tuple[int, int]:
    inserted = 0
    skipped = 0
    
    with pdfplumber.open(io.BytesIO(payload)) as pdf:
        pdf_type = _detect_pdf_type(pdf)
        
        # Skip bank statement PDFs - they should be imported via XLS
        if pdf_type == "bank":
            print(f"Skipping bank statement PDF (use XLS format for bank statements)")
            return 0, 0
        
        if pdf_type not in ("credit_card",):
            print(f"Unknown PDF type: {pdf_type}, attempting credit card parsing")
        
        seen_hashes = set()
        
        for page in pdf.pages:
            text = page.extract_text() or ""
            for line in text.splitlines():
                parsed = _parse_credit_card_line(line)
                if not parsed:
                    continue
                
                date_str, description_raw, amount = parsed
                posted_at = parse_date(date_str)
                if not posted_at:
                    skipped += 1
                    continue
                
                description_norm = normalize_description(description_raw)
                
                # Credit card expenses are typically positive in statement but should be negative (expense)
                # Skip if amount looks like a credit/payment (contains "AUTOPAY", "PAYMENT", "THANK YOU")
                is_payment = any(kw in description_norm.upper() for kw in ["AUTOPAY", "PAYMENT", "THANK YOU", "REFUND", "REVERSAL"])
                if is_payment:
                    amount = amount  # Keep positive (it's a credit to the card)
                else:
                    amount = -abs(amount)  # Make negative for expenses
                
                tx_hash = compute_hash(account_id, posted_at, amount, description_norm)
                
                # Skip duplicates within this import
                if tx_hash in seen_hashes:
                    continue
                seen_hashes.add(tx_hash)
                
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
                            amount,
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
