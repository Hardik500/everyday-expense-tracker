import io
import re
from typing import Optional, Tuple

import pdfplumber

from app.ingest.normalize import compute_hash, normalize_amount, normalize_description, parse_date


DATE_PATTERN = re.compile(r"(\d{2}[/-]\d{2}[/-]\d{2,4})")


def _parse_line(line: str) -> Optional[Tuple[str, str, float]]:
    date_match = DATE_PATTERN.search(line)
    if not date_match:
        return None
    date_str = date_match.group(1)
    tokens = line.split()
    if not tokens:
        return None
    amount_token = tokens[-1].replace(",", "")
    try:
        amount = float(amount_token)
    except ValueError:
        return None
    description = line.replace(date_str, "").replace(amount_token, "").strip()
    if not description:
        description = line.strip()
    return date_str, description, amount


def ingest_pdf(conn, account_id: int, statement_id: int, payload: bytes) -> Tuple[int, int]:
    inserted = 0
    skipped = 0
    with pdfplumber.open(io.BytesIO(payload)) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            for line in text.splitlines():
                parsed = _parse_line(line)
                if not parsed:
                    continue
                date_str, description_raw, amount = parsed
                posted_at = parse_date(date_str)
                if not posted_at:
                    skipped += 1
                    continue
                description_norm = normalize_description(description_raw)
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
