import io
import re
import os
from typing import Optional, Tuple, List, Set

import pdfplumber

from app.ingest.normalize import compute_hash, normalize_description, parse_amount, parse_date
from app.ingest.ai_parser import parse_with_gemini

# Import new statement-parser package (optional)
try:
    from statement_parser import StatementParser
    STATEMENT_PARSER_AVAILABLE = True
except ImportError:
    STATEMENT_PARSER_AVAILABLE = False

# Feature flag: USE_NEW_PARSER = True to use statement-parser package
# Set via environment variable: USE_NEW_STATEMENT_PARSER=true
USE_NEW_PARSER = os.environ.get("USE_NEW_STATEMENT_PARSER", "false").lower() in ("true", "1", "yes")

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


def _detect_card_type_from_text(text: str) -> str:
    """Detect which bank's statement this is from text content."""
    text_lower = text.lower()
    
    # Check for Savings/Bank Statement indicators FIRST
    # If found, return 'generic' to trigger AI parsing immediately
    # These keywords suggest a bank account statement, not a credit card
    if ("accountbranch" in text_lower.replace(" ", "") or 
        "withdrawalamt" in text_lower.replace(" ", "") or 
        "depositamt" in text_lower.replace(" ", "") or
        "closing balance" in text_lower):
        return "generic"
    
    if "icici" in text_lower or "amazon" in text_lower.replace(" ", ""):
        return "icici"
    if "sbi card" in text_lower or "sbicard" in text_lower.replace(" ", ""):
        return "sbi"
    if "hdfc" in text_lower:
        return "hdfc"
    # Added detection for Ixigo / AU Bank
    if "ixigo" in text_lower or "au credit" in text_lower or "au bank" in text_lower or "aubl" in text_lower:
        return "ixigo"
    
    return "generic"


def _detect_card_type(pdf) -> str:
    """Detect which bank's credit card statement this is."""
    first_page_text = ""
    for page in pdf.pages[:2]:
        first_page_text += (page.extract_text() or "") + "\n"
    return _detect_card_type_from_text(first_page_text)


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
    elif card_type == "ixigo":
        # For ixigo, the multi-line pattern is handled at page level
        # This function handles potential single-line matches
        return _parse_ixigo_line_single(line)
    else:
        # Try all parsers
        result = _parse_hdfc_line(line)
        if result:
            return result
        result = _parse_icici_line(line)
        if result:
            return result
        return _parse_sbi_line(line)


def _parse_ixigo_line_single(line: str) -> Optional[Tuple[str, str, float, bool]]:
    """
    Parse a single line from Ixigo statement (for use in multi-line contexts).
    Returns None for multi-line patterns handled elsewhere.
    """
    # This is a fallback for any single-line ixigo patterns
    # The main ixigo parsing is done at page level with _parse_ixigo_page
    return None


def _parse_enhanced_fallback(text: str, card_type: str) -> Optional[List[Tuple[str, str, float, bool]]]:
    """
    Enhanced fallback parser that tries multiple patterns to extract transactions
    when the primary parsers fail. This reduces reliance on AI for format variations.

    Uses a "learned pattern" approach - extracts what looks like a transaction
    and validates it matches the expected format.
    """
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    transactions = []

    # Skip common non-transaction lines
    skip_patterns = [
        r'^statement.*$',
        r'^total.*$',
        r'^payment.*due.*$',
        r'^credit.*limit.*$',
        r'^available.*balance.*$',
        r'^opening.*balance.*$',
        r'^closing.*balance.*$',
        r'^thank you.*$',
        r'^revised.*statement.*$',
    ]
    skip_regex = re.compile('|'.join(skip_patterns), re.IGNORECASE)

    # Pattern 1: Look for lines with amounts at the end, preceded by a date-like pattern
    # Common format: "DD Mon YYYY DESC AMOUNT Dr/Cr" (single line)
    amount_pattern = re.compile(r'([0-9,]+\.\d{2})\s*(Dr|Cr|DR|CR)?\s*$', re.IGNORECASE)

    for line in lines:
        line = line.strip()

        # Skip empty lines and headers
        if not line or len(line) < 10:
            continue

        # Skip if matches skip patterns
        if skip_regex.match(line):
            continue

        # Check if line ends with an amount
        amount_match = amount_pattern.search(line)
        if not amount_match:
            continue

        amount_str = amount_match.group(1)
        drcr = amount_match.group(2) or 'dr'
        amount = parse_amount(amount_str)

        if amount == 0:
            continue

        is_credit = drcr.lower() == 'cr'

        # Extract the part before the amount
        prefix = line[:amount_match.start()].strip()

        # Try to extract date from prefix
        # Common patterns: "DD Mon YYYY", "DD Mon YY", "DD/MM/YYYY"
        date_patterns = [
            (r'^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})', lambda m: f"{m.group(1)}/{m.group(2)}/{m.group(3)}"),
            (r'^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2})', lambda m: f"{m.group(1)}/{m.group(2)}/20{m.group(3)}"),
            (r'^(\d{2}/\d{2}/\d{4})', lambda m: m.group(1)),
        ]

        description = prefix
        posted_at = None

        for date_pattern, date_formatter in date_patterns:
            date_match = re.search(date_pattern, prefix)
            if date_match:
                try:
                    from dateutil import parser as date_parser
                    date_str = date_formatter(date_match)
                    # Try parsing with different formats
                    if '/' in date_str:
                        # DD/MM/YYYY or DD Mon YYYY format
                        if date_match.group(2).isalpha():
                            # It's "DD Mon YYYY" format
                            full_date = f"{date_match.group(1)} {date_match.group(2)} {date_match.group(3)}"
                            parsed = date_parser.parse(full_date, dayfirst=True)
                            posted_at = parsed.strftime("%d/%m/%Y")
                        else:
                            # It's DD/MM/YYYY format
                            posted_at = date_str
                        break
                except Exception:
                    continue

        if not posted_at:
            # Try to find date anywhere in line
            date_match = re.search(r'(\d{2}/\d{2}/\d{4})', line)
            if date_match:
                posted_at = date_match.group(1)

        if posted_at and description and amount != 0:
            # Clean up description
            for date_pattern, _ in date_patterns:
                description = re.sub(date_pattern, '', description).strip()
            description = re.sub(r'[\d\s]+$', '', description).strip()

            if len(description) > 2:
                transactions.append((posted_at, description, amount, is_credit))

    # Deduplicate by description and amount
    if transactions:
        seen = set()
        unique_txs = []
        for tx in transactions:
            key = (tx[0], tx[2], tx[3])  # date, amount, is_credit
            if key not in seen:
                seen.add(key)
                unique_txs.append(tx)
        return unique_txs

    return None


def _parse_ixigo_page(text: str) -> List[Tuple[str, str, float, bool]]:
    """
    Parse a page of Ixigo/AU Bank statement.
    Supports multiple formats:
    1. Standard 3-line pattern:
       Merchant Name
       12 ₹2,948.00
       Jan 26 Dr
    2. Single line pattern (DD Mon YY Description Amount Dr/Cr)
    3. Alternative amount format without ₹ symbol
    """
    transactions = []
    lines = [l.strip() for l in text.splitlines() if l.strip()]

    # Pattern 1: Standard 3-line format
    # Line 1: Description (merchant name)
    # Line 2: Day and Amount (with or without ₹)
    # Line 3: Month Year and Dr/Cr
    i = 0
    while i < len(lines) - 2:
        line1 = lines[i]      # Description
        line2 = lines[i+1]    # Day + Amount
        line3 = lines[i+2]    # Month Year + Dr/Cr

        # Skip lines that are likely headers or summary
        if any(kw in line1.lower() for kw in ['statement', 'total', 'limit', 'available', 'opening', 'closing', 'payment due']):
            i += 1
            continue

        # Line 2 should match "DD" followed by amount (with or without ₹ symbol)
        # Pattern: starts with day (1-2 digits), then optional space, optional ₹, optional space, amount
        line2_match = re.match(r"^(\d{1,2})\s*(?:₹|Rs\.?)?\s*([0-9,]+\.\d{2})\s*(?:Dr|Cr)?\s*$", line2, re.IGNORECASE)

        # Line 3 should match "Mon YY Dr/Cr" (optionally followed by extra content)
        # Example: "Jan 26 Dr" or "Jan 26 Cr 1015 RP" or "Jan 26" (day can be 1-2 digits)
        line3_match = re.match(r"^[A-Za-z]{3}\s+\d{1,2}\s*(Dr|Cr|DR|CR)?.*$", line3, re.IGNORECASE)

        if line2_match and line3_match:
            day = line2_match.group(1)
            amount_str = line2_match.group(2)

            # Get Dr/Cr from line 3 if present, otherwise check line 2
            drcr_match = re.search(r'(Dr|Cr|DR|CR)', line3, re.IGNORECASE)
            if not drcr_match:
                drcr_match = re.search(r'(Dr|Cr|DR|CR)', line2, re.IGNORECASE)

            drcr = drcr_match.group(1).lower() if drcr_match else "dr"  # Default to debit

            # Extract just "Mon YY" part from line3, excluding Dr/Cr and any extra content
            # line3 is like "Jan 26 Dr 1015 RP" or "Jan 26 Cr"
            mon_year_match = re.match(r'^([A-Za-z]{3}\s+\d{1,2})', line3)
            mon_year = mon_year_match.group(1) if mon_year_match else None
            if not mon_year:
                # Fallback: get the first 7 characters (e.g., "Jan 26")
                mon_year = line3[:7].strip()

            # Reconstruct date: "12 Jan 26"
            full_date_str = f"{day} {mon_year}"

            description = line1
            amount = parse_amount(amount_str)
            is_credit = drcr == "cr"

            # Convert date to DD/MM/YYYY
            try:
                from dateutil import parser as date_parser
                parsed_date = date_parser.parse(full_date_str, dayfirst=True)
                date_fmt = parsed_date.strftime("%d/%m/%Y")

                # Validate description is not empty or just a number
                if description and len(description) > 2 and not re.match(r'^[\d\s\.]+$', description):
                    transactions.append((date_fmt, description, amount, is_credit))
                i += 3
                continue
            except Exception as e:
                print(f"Date parsing error for '{full_date_str}': {e}")
                pass

        i += 1

    # Pattern 2: Single-line format (fallback if 3-line pattern not found)
    # Format: "DD Mon YYYY DESCRIPTION AMOUNT Dr/Cr" or similar variations
    if not transactions:
        print("Attempting single-line pattern parse for Ixigo statement")
        single_line_pattern = re.compile(
            r'^(\d{1,2})\s+'           # Day
            r'([A-Za-z]{3})\s+'        # Month
            r'(\d{2,4})\s+'            # Year
            r'(.+?)\s+'                # Description (non-greedy)
            r'([0-9,]+\.\d{2})\s*'     # Amount
            r'(Dr|Cr|DR|CR|D|C)?$',    # Debit/Credit (optional)
            re.IGNORECASE
        )

        for line in lines:
            line = line.strip()
            if not line or len(line) < 10:
                continue

            # Skip header/summary lines
            if any(kw in line.lower() for kw in ['statement', 'total', 'limit', 'available', 'opening', 'closing', 'payment due', 'thank you']):
                continue

            match = single_line_pattern.match(line)
            if match:
                day = match.group(1)
                month = match.group(2)
                year = match.group(3)
                description = match.group(4).strip()
                amount_str = match.group(5)
                drcr = match.group(6) or 'dr'  # Default to debit

                # Handle 2-digit year
                if len(year) == 2:
                    year = int(year)
                    year = 2000 + year if year < 50 else 1900 + year

                full_date_str = f"{day} {month} {year}"
                amount = parse_amount(amount_str)
                is_credit = drcr.lower() == 'cr'

                try:
                    from dateutil import parser as date_parser
                    parsed_date = date_parser.parse(full_date_str, dayfirst=True)
                    date_fmt = parsed_date.strftime("%d/%m/%Y")

                    if description and len(description) > 2:
                        transactions.append((date_fmt, description, amount, is_credit))
                except Exception:
                    pass

    # Pattern 3: Extract dates and amounts separately, then combine
    # Useful for statements where date/amount are on separate lines
    if not transactions:
        print("Attempting alternative pattern parse for Ixigo statement")

        # Find all potential transaction starts (lines starting with day number)
        day_pattern = re.compile(r'^(\d{1,2})\s*(₹|Rs\.?)?\s*([0-9,]+\.\d{2})\s*(Dr|Cr)?$', re.IGNORECASE)

        i = 0
        while i < len(lines):
            line = lines[i]

            # Check if this line starts with a day number
            day_match = day_pattern.match(line.strip())
            if day_match and i + 1 < len(lines):
                # Next line should be a date (Mon YY) and Dr/Cr
                next_line = lines[i+1].strip()
                # Support 1-2 digit day: "Jan 1" or "Jan 12"
                date_match = re.match(r'^([A-Za-z]{3}\s+\d{1,2})\s*(Dr|Cr)?$', next_line, re.IGNORECASE)

                if date_match:
                    day = day_match.group(1)
                    amount_str = day_match.group(3)
                    drcr = day_match.group(4) or date_match.group(2) or 'dr'
                    mon_year = date_match.group(1)

                    # Description is the line BEFORE the day+amount line (line i-1)
                    # e.g., "INDIAN OIL" is before "20 5,000.00"
                    if i > 0:
                        description = lines[i-1].strip()
                        # Skip if description looks like another date/amount
                        if description and (re.match(r'^[\d\s₹₹]+$', description) or len(description) < 3):
                            # Try going back one more line
                            if i > 1:
                                description = lines[i-2].strip()
                    else:
                        description = "Transaction"

                    full_date_str = f"{day} {mon_year}"
                    amount = parse_amount(amount_str)
                    is_credit = drcr.lower() == 'cr'

                    try:
                        from dateutil import parser as date_parser
                        parsed_date = date_parser.parse(full_date_str, dayfirst=True)
                        date_fmt = parsed_date.strftime("%d/%m/%Y")

                        if description and len(description) > 2:
                            transactions.append((date_fmt, description, amount, is_credit))
                        i += 2
                        continue
                    except Exception:
                        pass

            i += 1

    return transactions


def process_page_text(
    conn,
    account_id: int,
    statement_id: int,
    text: str,
    card_type: str,
    user_id: int,
    seen_hashes: Set[str]
) -> Tuple[int, int]:
    """Process extracted text from a page or file."""
    inserted = 0
    skipped = 0

    parsed_txs = []

    # 1. Page Parsers (Ixigo - most robust for this format)
    if card_type == "ixigo":
        parsed_txs = _parse_ixigo_page(text)
        if parsed_txs:
            print(f"Ixigo page parser found {len(parsed_txs)} transactions")

    # 2. Regex Loop (HDFC/ICICI/SBI/Ixigo single-line)
    # Only try regex if we haven't already parsed (via Ixigo) AND it's not generic
    if not parsed_txs and card_type != "generic":
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
            if is_credit:
                amount = abs(amount)
            else:
                amount = -abs(amount)

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

    # 3. Enhanced Fallback Parser (for format variations)
    # If regex didn't find transactions but we're not generic, try enhanced parsing
    if not parsed_txs and inserted == 0 and card_type != "generic":
        enhanced_txs = _parse_enhanced_fallback(text, card_type)
        if enhanced_txs:
            print(f"Enhanced fallback parser found {len(enhanced_txs)} transactions")
            parsed_txs = enhanced_txs

    # 4. AI FALLBACK
    # If no transactions were inserted by Regex/Page/Enhanced parsers, try AI.
    # This handles "generic" types AND cases where specific parsers failed (misclassification or format change)
    # NOTE: Skip AI for "generic" type as it's likely a bank statement that won't parse well with AI
    if not parsed_txs and inserted == 0 and card_type != "generic":
        print("No transactions found by regex/enhanced - attempting AI parsing...")
        parsed_txs = parse_with_gemini(text)
        if parsed_txs:
            print(f"AI found {len(parsed_txs)} transactions on page.")

    # Loop to insert AI results (or parsed results)
    if parsed_txs:
        for date_str, description_raw, amount, is_credit in parsed_txs:
            posted_at = parse_date(date_str)
            if not posted_at:
                skipped += 1
                continue

            description_norm = normalize_description(description_raw)

            if is_credit:
                amount = abs(amount)
            else:
                amount = -abs(amount)

            tx_hash = compute_hash(posted_at, amount, description_norm, user_id=user_id)

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

    return inserted, skipped


def ingest_text(conn, account_id: int, statement_id: int, payload: bytes, user_id: int) -> Tuple[int, int]:
    """Ingest a text file statement."""
    total_inserted = 0
    total_skipped = 0
    
    try:
        text = payload.decode("utf-8")
    except UnicodeDecodeError:
        try:
            text = payload.decode("latin-1")
        except:
            return 0, 0
            
    card_type = _detect_card_type_from_text(text)
    print(f"Detected text statement type: {card_type}")
    
    seen_hashes = set()
    
    ins, skp = process_page_text(conn, account_id, statement_id, text, card_type, user_id, seen_hashes)
    total_inserted += ins
    total_skipped += skp
    
    return total_inserted, total_skipped


def _save_parsed_pattern(conn, user_id: int, card_type: str, parsed_txs: List[Tuple[str, str, float, bool]]) -> None:
    """
    Save successful parsing patterns to the database for future use.
    This creates a "learning" mechanism that reduces AI calls over time.
    """
    if not parsed_txs:
        return

    # Analyze patterns from successfully parsed transactions
    date_patterns = []
    amount_patterns = []
    description_patterns = []

    for date_str, description, amount, is_credit in parsed_txs:
        # Extract date pattern (format: DD/MM/YYYY)
        if '/' in date_str:
            parts = date_str.split('/')
            if len(parts) == 3:
                day, month, year = parts
                # Store common date patterns
                date_patterns.append(f"{day}/{month}/")

        # Extract amount pattern (look for decimal format)
        amount_str = f"{amount:.2f}"
        if '.' in amount_str:
            integer_part = amount_str.split('.')[0]
            # Store pattern like "XXX.XX"
            amount_patterns.append("XXX.XX")

        # Extract description patterns (common merchant names or patterns)
        if description:
            # Extract word patterns (e.g., "IXIGO" -> "[A-Z]+")
            # For now, store the description itself for potential regex generation
            description_patterns.append(description)

    # Store these patterns in the database for learning
    # Create a pattern record that can be used for future parsing
    try:
        conn.execute(
            """
            INSERT OR REPLACE INTO learning_patterns
            (user_id, card_type, date_pattern, amount_pattern, description_sample, created_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (
                user_id,
                card_type,
                '|'.join(date_patterns[:5]) if date_patterns else None,
                '|'.join(amount_patterns[:3]) if amount_patterns else None,
                '|'.join(description_patterns[:10]) if description_patterns else None,
            ),
        )
        conn.commit()
    except Exception as e:
        # Table might not exist yet, which is fine
        print(f"Could not save pattern: {e}")


def _ingest_with_new_parser(conn, account_id: int, statement_id: int, payload: bytes, user_id: int) -> Tuple[int, int, int]:
    """
    Ingest PDF using the new expense-statement-parser package.
    
    This uses pattern-based parsing with optional AI fallback.
    Returns: (inserted, skipped, transactions_found)
    """
    inserted = 0
    skipped = 0
    transactions_found = 0
    
    if not STATEMENT_PARSER_AVAILABLE:
        print("New statement-parser package not available")
        return 0, 0, 0
    
    try:
        # Save PDF to temp file for the package
        import tempfile
        
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
            tmp.write(payload)
            tmp_path = tmp.name
        
        try:
            # Use the new package
            parser = StatementParser()
            result = parser.parse_file(tmp_path)
            
            transactions_found = len(result.transactions)
            print(f"New parser detected: {result.statement_type} with {transactions_found} transactions")
            
            seen_hashes = set()
            
            for tx in result.transactions:
                # Extract date
                date_str = tx.get('date', '')
                posted_at = parse_date(date_str)
                if not posted_at:
                    skipped += 1
                    continue
                
                # Extract description
                description_raw = tx.get('description', '') or tx.get('narration', '')
                description_norm = normalize_description(description_raw)
                
                # Extract amount and type
                debit = float(tx.get('debit', 0) or 0)
                credit = float(tx.get('credit', 0) or 0)
                
                if credit > 0:
                    amount = credit
                    is_credit = True
                elif debit > 0:
                    amount = -debit
                    is_credit = False
                else:
                    # Try 'amount' field
                    amount_val = float(tx.get('amount', 0) or 0)
                    tx_type = tx.get('type', 'debit').lower()
                    is_credit = tx_type == 'credit'
                    amount = amount_val if is_credit else -amount_val
                
                if amount == 0:
                    skipped += 1
                    continue
                
                # Compute hash for deduplication
                tx_hash = compute_hash(posted_at, amount, description_norm, user_id=user_id)
                
                if tx_hash in seen_hashes:
                    skipped += 1
                    continue
                seen_hashes.add(tx_hash)
                
                # Insert transaction
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
                    print(f"Error inserting transaction: {e}")
                    skipped += 1
            
            print(f"New parser: {inserted} inserted, {skipped} skipped (from {transactions_found} found)")
            
        finally:
            # Clean up temp file
            try:
                os.unlink(tmp_path)
            except:
                pass
                
    except Exception as e:
        print(f"New parser error: {e}")
        return 0, 0, 0
    
    return inserted, skipped, transactions_found


def ingest_pdf(conn, account_id: int, statement_id: int, payload: bytes, user_id: int) -> Tuple[int, int]:
    """
    Ingest PDF using HYBRID approach:
    1. Try new statement-parser package first
    2. Fall back to old logic if new fails
    3. Track which parser was used in the database
    """
    
    inserted = 0
    skipped = 0
    parser_used = "unknown"
    parser_version = None
    transactions_found = 0
    parser_error = None
    
    # Try new parser first (if available)
    if STATEMENT_PARSER_AVAILABLE:
        print("[HYBRID] Trying NEW statement-parser package...")
        try:
            new_inserted, new_skipped, transactions_found = _ingest_with_new_parser(
                conn, account_id, statement_id, payload, user_id
            )
            
            if new_inserted > 0:
                print(f"[HYBRID] New parser succeeded: {new_inserted} transactions inserted")
                inserted = new_inserted
                skipped = new_skipped
                parser_used = "statement-parser"
                parser_version = "0.1.1"
            else:
                print(f"[HYBRID] New parser found {transactions_found} but inserted 0, will try old logic...")
                
        except Exception as e:
            print(f"[HYBRID] New parser failed: {e}")
            parser_error = str(e)[:500]  # Limit error message length
    else:
        print("[HYBRID] New parser not available, using old logic...")
    
    # Fall back to old logic if new parser didn't work
    if inserted == 0:
        print("[HYBRID] Falling back to OLD logic...")
        try:
            old_inserted, old_skipped, old_found = _ingest_with_old_parser(
                conn, account_id, statement_id, payload, user_id
            )
            inserted = old_inserted
            skipped = old_skipped
            transactions_found = old_found
            parser_used = "legacy"
            parser_version = "1.0"
            print(f"[HYBRID] Old parser: {inserted} inserted, {skipped} skipped")
            
        except Exception as e:
            print(f"[HYBRID] Old parser also failed: {e}")
            parser_error = f"New: {parser_error or 'N/A'} | Old: {str(e)[:200]}"
    
    # Update statement record with parser info
    try:
        conn.execute(
            """
            UPDATE statements 
            SET parser = ?,
                parser_version = ?,
                transactions_found = ?,
                transactions_inserted = ?,
                parser_error = ?
            WHERE id = ?
            """,
            (parser_used, parser_version, transactions_found, inserted, parser_error, statement_id)
        )
        conn.commit()
        print(f"[HYBRID] Updated statement {statement_id} with parser={parser_used}")
    except Exception as e:
        print(f"[HYBRID] Could not update statement record: {e}")
    
    print(f"[HYBRID] Final: {inserted} inserted, {skipped} skipped (using {parser_used})")
    return inserted, skipped


def _ingest_with_old_parser(conn, account_id: int, statement_id: int, payload: bytes, user_id: int) -> Tuple[int, int, int]:
    """
    Original/old PDF parsing logic.
    Returns: (inserted, skipped, found)
    """
    inserted = 0
    skipped = 0
    found = 0
    
    with pdfplumber.open(io.BytesIO(payload)) as pdf:
        pdf_type = _detect_pdf_type(pdf)
        
        if pdf_type == "bank":
            print(f"Detected bank statement PDF - attempting generic parsing")
        
        card_type = _detect_card_type(pdf)
        print(f"Detected card type: {card_type}")
        
        seen_hashes = set()
        
        for page in pdf.pages:
            text = page.extract_text() or ""
            ins, skp = process_page_text(conn, account_id, statement_id, text, card_type, user_id, seen_hashes)
            inserted += ins
            skipped += skp
            found += ins + skp  # Count all potential transactions found
        
        if inserted > 0:
            _save_parsed_pattern(conn, user_id, card_type, [])
    
    return inserted, skipped, found
