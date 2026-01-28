from datetime import datetime, timedelta, date
from typing import Optional, List, Dict


def _to_float(val):
    """Ensure value is a float."""
    if val is None:
        return 0.0
    return float(val)


def _to_datetime(val):
    """Ensure value is a datetime object."""
    if isinstance(val, datetime):
        return val
    if isinstance(val, date):
        return datetime.combine(val, datetime.min.time())
    if isinstance(val, str):
        # Handle formats like '2024-01-01' or '2024-01-01T00:00:00'
        return datetime.fromisoformat(val.replace('Z', '+00:00'))
    return val


def link_card_payments(conn, account_id: Optional[int] = None, user_id: Optional[int] = None) -> None:
    """Link credit card bill payments from bank to card accounts."""
    
    # Bank payments query - only filter by user, not account_id
    if user_id is not None:
        bank_payments = conn.execute(
            """
            SELECT t.id, t.posted_at, t.amount, t.description_norm
            FROM transactions t
            JOIN accounts a ON a.id = t.account_id
            WHERE a.type = 'bank'
              AND t.description_norm LIKE '%%CARD%%PAYMENT%%'
              AND t.user_id = ?
            """,
            (user_id,),
        ).fetchall()
    else:
        bank_payments = conn.execute(
            """
            SELECT t.id, t.posted_at, t.amount, t.description_norm
            FROM transactions t
            JOIN accounts a ON a.id = t.account_id
            WHERE a.type = 'bank'
              AND t.description_norm LIKE '%%CARD%%PAYMENT%%'
            """
        ).fetchall()

    # Card transactions query - filter by both account_id and user_id if provided
    if account_id is not None and user_id is not None:
        card_transactions = conn.execute(
            """
            SELECT t.id, t.posted_at, t.amount
            FROM transactions t
            JOIN accounts a ON a.id = t.account_id
            WHERE a.type = 'card'
              AND t.account_id = ?
              AND t.user_id = ?
            """,
            (account_id, user_id),
        ).fetchall()
    elif account_id is not None:
        card_transactions = conn.execute(
            """
            SELECT t.id, t.posted_at, t.amount
            FROM transactions t
            JOIN accounts a ON a.id = t.account_id
            WHERE a.type = 'card'
              AND t.account_id = ?
            """,
            (account_id,),
        ).fetchall()
    elif user_id is not None:
        card_transactions = conn.execute(
            """
            SELECT t.id, t.posted_at, t.amount
            FROM transactions t
            JOIN accounts a ON a.id = t.account_id
            WHERE a.type = 'card'
              AND t.user_id = ?
            """,
            (user_id,),
        ).fetchall()
    else:
        card_transactions = conn.execute(
            """
            SELECT t.id, t.posted_at, t.amount
            FROM transactions t
            JOIN accounts a ON a.id = t.account_id
            WHERE a.type = 'card'
            """
        ).fetchall()

    for payment in bank_payments:
        payment_date = _to_datetime(payment["posted_at"])
        window_start = (payment_date - timedelta(days=5)).date()
        window_end = (payment_date + timedelta(days=5)).date()
        matches = [
            tx
            for tx in card_transactions
            if window_start <= tx["posted_at"] <= window_end
            and abs(abs(tx["amount"]) - abs(payment["amount"])) < 0.01
        ]
        for match in matches:
            conn.execute(
                """
                INSERT INTO transaction_links
                (source_transaction_id, target_transaction_id, link_type)
                VALUES (?, ?, 'card_payment')
                ON CONFLICT DO NOTHING
                """,
                (payment["id"], match["id"]),
            )


def find_potential_transfers(conn, days_window: int = 7, user_id: Optional[int] = None) -> List[Dict]:
    """
    Find potential internal transfers that aren't already linked.
    """
    user_clause = " AND t.user_id = ?" if user_id is not None else ""
    user_param = [user_id] if user_id is not None else []

    # Get all transactions not already linked
    all_txs = conn.execute(
        f"""
        SELECT t.id, t.account_id, a.name as account_name, a.type as account_type,
               t.posted_at, t.amount, t.description_raw, t.description_norm,
               c.name as category_name
        FROM transactions t
        JOIN accounts a ON a.id = t.account_id
        LEFT JOIN categories c ON c.id = t.category_id
        WHERE t.id NOT IN (
            SELECT source_transaction_id FROM transaction_links WHERE link_type != 'ignored'
            UNION
            SELECT target_transaction_id FROM transaction_links WHERE link_type != 'ignored'
        )
        {user_clause}
        ORDER BY t.posted_at DESC
    """,
    user_param
    ).fetchall()

    # Get ignored pairs to filter them out
    ignored_rows = conn.execute(
        "SELECT l.source_transaction_id, l.target_transaction_id FROM transaction_links l JOIN transactions t ON t.id = l.source_transaction_id WHERE l.link_type = 'ignored'" + 
        (f" AND t.user_id = {user_id}" if user_id is not None else "")
    ).fetchall()
    ignored_pairs = {
        tuple(sorted([row["source_transaction_id"], row["target_transaction_id"]]))
        for row in ignored_rows
    }

    potential_pairs = []
    checked_pairs = set()

    for tx1 in all_txs:
        tx1_date = _to_datetime(tx1["posted_at"])
        
        for tx2 in all_txs:
            # Skip same transaction or same account
            if tx1["id"] == tx2["id"] or tx1["account_id"] == tx2["account_id"]:
                continue
            
            # Skip if already checked (avoid duplicates)
            pair_key = tuple(sorted([tx1["id"], tx2["id"]]))
            if pair_key in checked_pairs:
                continue
            checked_pairs.add(pair_key)
            
            # Skip if explicitly ignored
            if pair_key in ignored_pairs:
                continue
            
            # Check if amounts are opposite (one debit, one credit)
            tx1_amount = _to_float(tx1["amount"])
            tx2_amount = _to_float(tx2["amount"])
            if tx1_amount * tx2_amount >= 0:  # Same sign
                continue
            
            # Check if amounts match (within 1%)
            amount_diff = abs(abs(tx1_amount) - abs(tx2_amount))
            if amount_diff > max(1, abs(tx1_amount) * 0.01):
                continue
            
            # Check if within date window
            tx2_date = _to_datetime(tx2["posted_at"])
            if abs((tx1_date - tx2_date).days) > days_window:
                continue
            
            # Calculate confidence score
            confidence = calculate_transfer_confidence(tx1, tx2)
            
            if confidence >= 50:  # Only suggest if reasonably confident
                # Determine source (debit) and target (credit)
                if tx1["amount"] < 0:
                    source, target = tx1, tx2
                else:
                    source, target = tx2, tx1
                
                potential_pairs.append({
                    "source": dict(source),
                    "target": dict(target),
                    "confidence": confidence,
                    "amount": abs(_to_float(source["amount"])),
                })
    
    # Sort by confidence, then amount
    potential_pairs.sort(key=lambda x: (-x["confidence"], -x["amount"]))
    return potential_pairs[:50]  # Limit to top 50


def calculate_transfer_confidence(tx1: Dict, tx2: Dict) -> int:
    """Calculate confidence score (0-100) that two transactions are an internal transfer."""
    score = 50  # Base score for matching amount + opposite signs + date proximity
    
    # Exact amount match
    tx1_amount = _to_float(tx1["amount"])
    tx2_amount = _to_float(tx2["amount"])
    if abs(tx1_amount) == abs(tx2_amount):
        score += 15
    
    # Same day
    tx1_dt = _to_datetime(tx1["posted_at"])
    tx2_dt = _to_datetime(tx2["posted_at"])
    if tx1_dt.date() == tx2_dt.date():
        score += 15
    
    # Keywords suggesting transfers
    transfer_keywords = ["transfer", "neft", "imps", "rtgs", "upi", "payment", "card"]
    tx1_desc = tx1["description_norm"].lower() if tx1["description_norm"] else ""
    tx2_desc = tx2["description_norm"].lower() if tx2["description_norm"] else ""
    
    for kw in transfer_keywords:
        if kw in tx1_desc or kw in tx2_desc:
            score += 5
            break
    
    # Bank to card (CC payment)
    if tx1["account_type"] == "bank" and tx2["account_type"] == "card":
        score += 10
    elif tx1["account_type"] == "card" and tx2["account_type"] == "bank":
        score += 10
    
    return min(100, score)


def auto_categorize_linked_transfers(conn, user_id: Optional[int] = None) -> int:
    """
    Categorize linked transactions as Transfers.
    Returns count of transactions updated.
    """
    user_clause = " AND user_id = ?" if user_id is not None else ""
    user_params = [user_id] if user_id is not None else []

    # Get the Transfers category and Credit Card Payment subcategory
    transfers_cat = conn.execute(
        "SELECT id FROM categories WHERE name = 'Transfers'" + user_clause,
        user_params
    ).fetchone()
    
    if not transfers_cat:
        return 0
    
    cc_payment_sub = conn.execute(
        "SELECT id FROM subcategories WHERE category_id = ? AND name LIKE '%%Credit Card%%'" + user_clause,
        [transfers_cat["id"]] + user_params
    ).fetchone()
    
    subcat_id = cc_payment_sub["id"] if cc_payment_sub else None
    
    # Update all linked transactions
    result = conn.execute(
        f"""
        UPDATE transactions
        SET category_id = ?, subcategory_id = ?, is_uncertain = FALSE
        WHERE id IN (
            SELECT source_transaction_id FROM transaction_links WHERE link_type != 'ignored'
            UNION
            SELECT target_transaction_id FROM transaction_links WHERE link_type != 'ignored'
        )
        AND (category_id IS NULL OR category_id != ?)
        {user_clause}
        """,
        [transfers_cat["id"], subcat_id, transfers_cat["id"]] + user_params
    )
    conn.commit()
    return result.rowcount
