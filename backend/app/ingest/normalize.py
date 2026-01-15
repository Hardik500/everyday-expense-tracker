import hashlib
import re
from typing import Optional

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


def normalize_amount(amount: Optional[float]) -> float:
    if amount is None:
        return 0.0
    return float(amount)
