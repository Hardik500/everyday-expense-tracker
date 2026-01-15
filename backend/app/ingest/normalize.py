import hashlib
import re
from typing import Optional, Union

from dateutil import parser
from dateutil.parser import ParserError


def parse_date(value: str) -> Optional[str]:
    if not value or not str(value).strip():
        return None
    try:
        parsed = parser.parse(str(value), dayfirst=True, fuzzy=True)
    except (ParserError, ValueError, TypeError):
        return None
    return parsed.date().isoformat()


def normalize_description(text: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9]+", " ", text or "")
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned.upper()


def compute_hash(
    account_id: int, posted_at: str, amount: float, description_norm: str
) -> str:
    payload = f"{account_id}|{posted_at}|{amount:.2f}|{description_norm}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def parse_amount(value: Union[str, float, int, None]) -> float:
    """
    Parse amount from various formats including Indian number format.
    Handles formats like:
    - "1,00,000.50" (Indian lakh format)
    - "1,000.39" (Standard comma format)
    - "1000.39" (Plain number)
    - "-1,000.39" (Negative)
    - "(1,000.39)" (Accounting negative)
    - "Rs. 1,000.39" or "₹1,000.39" (With currency symbol)
    """
    if value is None:
        return 0.0
    
    if isinstance(value, (int, float)):
        return float(value)
    
    text = str(value).strip()
    if not text:
        return 0.0
    
    # Check for accounting format negative (parentheses)
    is_negative = False
    if text.startswith("(") and text.endswith(")"):
        is_negative = True
        text = text[1:-1].strip()
    
    # Check for minus sign
    if text.startswith("-"):
        is_negative = True
        text = text[1:].strip()
    
    # Remove currency prefixes (Rs., INR, ₹, etc.) - these are word patterns, not individual chars
    text = re.sub(r"^(Rs\.?|INR|₹|\$|€|£|¥)\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*(Rs\.?|INR|₹|\$|€|£|¥)$", "", text, flags=re.IGNORECASE)
    
    # Remove any remaining currency symbols (but NOT periods which are decimal separators)
    text = re.sub(r"[₹$€£¥]", "", text)
    
    # Handle "Dr" (debit) and "Cr" (credit) suffixes common in Indian statements
    if text.upper().endswith("DR"):
        is_negative = True
        text = text[:-2].strip()
    elif text.upper().endswith("CR"):
        is_negative = False
        text = text[:-2].strip()
    
    # Remove all commas (handles both 1,000.39 and 1,00,000.39 formats)
    text = text.replace(",", "")
    
    # Remove any whitespace
    text = text.strip()
    
    # Handle case where there's no decimal point
    try:
        amount = float(text)
        return -amount if is_negative else amount
    except (ValueError, TypeError):
        return 0.0


def normalize_amount(amount: Optional[float]) -> float:
    """Legacy function - use parse_amount for string parsing."""
    if amount is None:
        return 0.0
    return float(amount)
