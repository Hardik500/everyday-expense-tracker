import re
from typing import Optional, Tuple

from app.rules.ai import ai_classify


def _load_rules(conn):
    return conn.execute(
        """
        SELECT id, name, pattern, category_id, subcategory_id, min_amount,
               max_amount, priority, account_type, merchant_contains
        FROM rules
        WHERE active = 1
        ORDER BY priority DESC, id ASC
        """
    ).fetchall()


def _sql_like_to_regex(pattern: str) -> str:
    """Convert SQL LIKE pattern to Regex."""
    parts = []
    for char in pattern:
        if char == "%":
            parts.append(".*")
        elif char == "_":
            parts.append(".")
        else:
            parts.append(re.escape(char))
    return "^" + "".join(parts) + "$"


def _match_rule(rule, description_norm: str, amount: float, account_type: Optional[str]) -> bool:
    if rule["account_type"] and account_type and rule["account_type"] != account_type:
        return False
    if rule["merchant_contains"] and rule["merchant_contains"].upper() not in description_norm:
        return False
    if rule["min_amount"] is not None and amount < rule["min_amount"]:
        return False
    if rule["max_amount"] is not None and amount > rule["max_amount"]:
        return False
    try:
        # Convert SQL LIKE pattern (used in DB) to Regex (used in Python)
        regex = _sql_like_to_regex(rule["pattern"])
        return re.search(regex, description_norm, re.IGNORECASE) is not None
    except re.error:
        return False


def _score_rule(rule, description_norm: str) -> int:
    score = int(rule["priority"] or 0)
    if rule["merchant_contains"]:
        score += 10
    if len(description_norm) > 20:
        score += 5
    return score


def apply_rules(
    conn, account_id: Optional[int] = None, statement_id: Optional[int] = None
) -> None:
    clauses = []
    params = []
    if account_id is not None:
        clauses.append("t.account_id = ?")
        params.append(account_id)
    if statement_id is not None:
        clauses.append("t.statement_id = ?")
        params.append(statement_id)
    where = f"AND {' AND '.join(clauses)}" if clauses else ""

    transactions = conn.execute(
        f"""
        SELECT t.id, t.description_norm, t.amount, t.account_id, a.type as account_type
        FROM transactions t
        JOIN accounts a ON a.id = t.account_id
        WHERE t.is_uncertain = 1 {where}
        """,
        params,
    ).fetchall()

    rules = _load_rules(conn)

    for tx in transactions:
        # First check for existing mappings (user-created)
        mapping = conn.execute(
            """
            SELECT category_id, subcategory_id
            FROM mappings
            WHERE description_norm = ?
            """,
            (tx["description_norm"],),
        ).fetchone()
        if mapping:
            conn.execute(
                """
                UPDATE transactions
                SET category_id = ?, subcategory_id = ?, is_uncertain = 0
                WHERE id = ?
                """,
                (mapping["category_id"], mapping["subcategory_id"], tx["id"]),
            )
            continue

        # Try to match against rules
        best: Optional[Tuple[int, int]] = None
        best_score = -1
        for rule in rules:
            if not _match_rule(rule, tx["description_norm"], tx["amount"], tx["account_type"]):
                continue
            score = _score_rule(rule, tx["description_norm"])
            if score > best_score:
                best_score = score
                best = (rule["category_id"], rule["subcategory_id"])

        # If no rule matched, try AI classification
        if not best:
            ai_match = ai_classify(
                tx["description_norm"],
                tx["amount"],
                conn=conn,  # Pass connection so AI can look up categories and create rules
            )
            if ai_match:
                best = ai_match
                best_score = 55  # AI matches have medium confidence

        if best:
            # Mark as certain if score is high enough
            is_uncertain = 0 if best_score >= 50 else 1
            conn.execute(
                """
                UPDATE transactions
                SET category_id = ?, subcategory_id = ?, is_uncertain = ?
                WHERE id = ?
                """,
                (best[0], best[1], is_uncertain, tx["id"]),
            )
