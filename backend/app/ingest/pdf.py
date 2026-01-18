import io
import re
from typing import Optional, Tuple, List

import pdfplumber

from app.ingest.normalize import compute_hash, normalize_description, parse_amount, parse_date


# Date patterns
DATE_PATTERN = re.compile(r"(\d{2}/\d{2}/\d{4})")

# Pattern for amounts: handles 1,234.56 or 1234.56 with optional Cr/CR suffix
AMOUNT_PATTERN = re.compile(r"([0-9,]+\.\d{2})\s*(Cr|CR)?$")


def _detect_pdf_type(pdf) -> str:
    """Detect if PDF is a credit card statement or bank statement."""
    first_page_text = ""
    for page in pdf.pages[:2]:
        first_page_text += (page.extract_text() or "") + "\n"
    
    text_lower = first_page_text.lower()
    
    # Credit card indicators
    if "credit card" in text_lower or "card statement" in text_lower:
        return "credit_card"
    
    # Bank statement indicators (HDFC bank statement specific)
    if ("accountbranch" in text_lower.replace(" ", "") or 
        "withdrawalamt" in text_lower.replace(" ", "") or 
        "depositamt" in text_lower.replace(" ", "")):
        return "bank"
    
    # If has transaction-like lines with dates, assume credit card
    if DATE_PATTERN.search(first_page_text):
        return "credit_card"
    
    return "unknown"


def _detect_card_type(pdf) -> str:
    """Detect which bank's credit card statement this is."""
    first_page_text = ""
    for page in pdf.pages[:2]:
        first_page_text += (page.extract_text() or "") + "\n"
    
    text_lower = first_page_text.lower()
    
    if "icici" in text_lower or "amazon" in text_lower.replace(" ", ""):
        return "icici"
    if "sbi card" in text_lower or "sbicard" in text_lower.replace(" ", ""):
        return "sbi"
    if "hdfc" in text_lower:
        return "hdfc"
    
    return "generic"


def _parse_hdfc_line(line: str) -> Optional[Tuple[str, str, float, bool]]:
    """
    Parse HDFC credit card line.
    Format: DATE TIME DESCRIPTION [POINTS] AMOUNT [Cr]
    Example: 12/03/2025 20:58:42 CALIFORNIA BURRITO BANGALORE 4 293.00
    Example: 19/03/2025 10:34:29 TELE TRANSFER CREDIT (Ref# ...) 1,02,613.00Cr
    Returns: (date_str, description, amount, is_credit)
    """
    # Must start with date
    date_match = DATE_PATTERN.search(line)
    if not date_match:
        return None
    
    # Skip non-transaction lines
    skip_keywords = ["statement date", "payment due", "credit limit", "available", 
                     "address", "email", "name:", "hsn code", "gstin", 
                     "personal details", "please write", "average daily",
                     "fresh purchases"]
    if any(kw in line.lower() for kw in skip_keywords):
        return None
    
    # Find amount at end
    amount_match = AMOUNT_PATTERN.search(line)
    if not amount_match:
        return None
    
    date_str = date_match.group(1)
    amount = parse_amount(amount_match.group(1))
    is_credit = amount_match.group(2) is not None  # Has Cr/CR suffix
    
    if amount <= 0:
        return None
    
    # Extract description: everything between date/time and amount
    # Remove date
    desc = line[date_match.end():].strip()
    # Remove time if present (HH:MM:SS)
    desc = re.sub(r"^\d{2}:\d{2}(:\d{2})?\s*", "", desc)
    # Remove amount portion
    desc = re.sub(r"[0-9,]+\.\d{2}\s*(Cr|CR)?$", "", desc).strip()
    # Remove trailing points number if present (single digit or small number at end)
    desc = re.sub(r"\s+\d{1,3}$", "", desc).strip()
    
    if not desc or len(desc) < 3:
        return None
    
    # Skip if description is just numbers (likely a parsing error)
    if re.match(r'^[\d,.\s]+$', desc):
        return None
    
    return date_str, desc, amount, is_credit


def _parse_icici_line(line: str) -> Optional[Tuple[str, str, float, bool]]:
    """
    Parse ICICI/Amazon credit card line.
    Format: DATE REF_NUM DESCRIPTION [POINTS] AMOUNT [CR]
    Example: 06/04/2025 11049594561 IND*AMAZON HTTP://WWW.AM IN 29 599.00
    Example: 13/04/2025 11082771581 BBPS Payment received 0 9,720.00 CR
    Returns: (date_str, description, amount, is_credit)
    """
    # Must start with date
    date_match = DATE_PATTERN.search(line)
    if not date_match:
        return None
    
    # Skip headers and summary lines
    skip_keywords = ["statement date", "payment due", "total amount", "minimum amount",
                     "credit limit", "credit summary"]
    if any(kw in line.lower() for kw in skip_keywords):
        return None
    
    # Find amount - look for number pattern at end
    # ICICI format: AMOUNT [CR] or just AMOUNT
    amount_match = re.search(r"([0-9,]+\.\d{2})\s*(CR)?$", line, re.IGNORECASE)
    if not amount_match:
        return None
    
    date_str = date_match.group(1)
    amount = parse_amount(amount_match.group(1))
    is_credit = amount_match.group(2) is not None
    
    if amount <= 0:
        return None
    
    # Extract description
    desc = line[date_match.end():].strip()
    # Remove reference number (11 digit number at start)
    desc = re.sub(r"^\d{10,12}\s*", "", desc)
    # Remove amount at end
    desc = re.sub(r"[0-9,]+\.\d{2}\s*(CR)?$", "", desc, flags=re.IGNORECASE).strip()
    # Remove trailing points/percentage
    desc = re.sub(r"\s+[-\d]+%?\s*$", "", desc).strip()
    desc = re.sub(r"\s+\d{1,3}$", "", desc).strip()
    
    if not desc or len(desc) < 3:
        return None
    
    return date_str, desc, amount, is_credit


def _parse_sbi_line(line: str) -> Optional[Tuple[str, str, float, bool]]:
    """
    Parse SBI credit card line.
    Format: DD Mon YY DESCRIPTION AMOUNT D/C
    Example: 06 Oct 25 BISTRO GURGAON IND 148.00 D
    Example: 03 Dec 25 CARD CASHBACK CREDIT 32.00 C
    Returns: (date_str, description, amount, is_credit)
    """
    # SBI uses format like "06 Oct 25" - DD Mon YY
    sbi_date_pattern = re.compile(r"(\d{2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2})", re.IGNORECASE)
    date_match = sbi_date_pattern.search(line)
    if not date_match:
        return None
    
    # Skip headers and non-transaction lines
    skip_keywords = ["statement", "amount due", "credit limit", "available", "gstin", 
                     "period:", "date transaction", "for this"]
    if any(kw in line.lower() for kw in skip_keywords):
        return None
    
    # Find amount at end with D/C suffix: AMOUNT D or AMOUNT C
    # Pattern: number followed by D or C at end
    amount_match = re.search(r"([0-9,]+\.\d{2})\s*([DC])\s*$", line, re.IGNORECASE)
    if not amount_match:
        return None
    
    date_str = date_match.group(1)
    amount = parse_amount(amount_match.group(1))
    is_credit = amount_match.group(2).upper() == 'C'
    
    if amount <= 0:
        return None
    
    # Extract description: everything between date and amount
    desc = line[date_match.end():].strip()
    # Remove amount and D/C marker
    desc = re.sub(r"[0-9,]+\.\d{2}\s*[DC]\s*$", "", desc, flags=re.IGNORECASE).strip()
    
    if not desc or len(desc) < 3:
        return None
    
    # Convert SBI date format to standard
    # "06 Oct 25" -> "06/10/2025"
    try:
        from dateutil import parser as date_parser
        parsed_date = date_parser.parse(date_str, dayfirst=True)
        date_str = parsed_date.strftime("%d/%m/%Y")
    except:
        pass
    
    return date_str, desc, amount, is_credit


def _parse_credit_card_line(line: str, card_type: str) -> Optional[Tuple[str, str, float, bool]]:
    """Parse a credit card PDF line based on card type."""
    if card_type == "hdfc":
        return _parse_hdfc_line(line)
    elif card_type == "icici":
        return _parse_icici_line(line)
    elif card_type == "sbi":
        return _parse_sbi_line(line)
    else:
        # Try all parsers
        result = _parse_hdfc_line(line)
        if result:
            return result
        result = _parse_icici_line(line)
        if result:
            return result
        return _parse_sbi_line(line)


def ingest_pdf(conn, account_id: int, statement_id: int, payload: bytes, user_id: int) -> Tuple[int, int]:
    inserted = 0
    skipped = 0
    
    with pdfplumber.open(io.BytesIO(payload)) as pdf:
        pdf_type = _detect_pdf_type(pdf)
        
        # Skip bank statement PDFs - they should be imported via XLS
        if pdf_type == "bank":
            print(f"Skipping bank statement PDF (use XLS format for bank statements)")
            return 0, 0
        
        card_type = _detect_card_type(pdf)
        print(f"Detected card type: {card_type}")
        
        seen_hashes = set()
        
        for page in pdf.pages:
            text = page.extract_text() or ""
            for line in text.splitlines():
                line = line.strip()
                if not line:
                    continue
                
                parsed = _parse_credit_card_line(line, card_type)
                if not parsed:
                    continue
                
                date_str, description_raw, amount, is_credit = parsed
                posted_at = parse_date(date_str)
                if not posted_at:
                    skipped += 1
                    continue
                
                description_norm = normalize_description(description_raw)
                
                # Determine sign:
                # - Credits (payments, refunds) should be positive
                # - Debits (purchases) should be negative
                if is_credit:
                    amount = abs(amount)  # Credit to card (payment received, refund)
                else:
                    amount = -abs(amount)  # Debit (expense)
                
                tx_hash = compute_hash(posted_at, amount, description_norm, user_id=user_id)
                
                # Skip duplicates within this import
                if tx_hash in seen_hashes:
                    continue
                seen_hashes.add(tx_hash)
                
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
                except Exception as e:
                    skipped += 1
    
    print(f"PDF import: {inserted} inserted, {skipped} skipped")
    return inserted, skipped
