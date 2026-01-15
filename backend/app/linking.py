from datetime import datetime, timedelta
from typing import Optional, List, Dict


def link_card_payments(conn, account_id: Optional[int] = None) -> None:
    """Link credit card bill payments from bank to card accounts."""
    clauses = []
    params = []
    if account_id is not None:
        clauses.append("t.account_id = ?")
        params.append(account_id)
    where = f"AND {' AND '.join(clauses)}" if clauses else ""

    bank_payments = conn.execute(
        f"""
        SELECT t.id, t.posted_at, t.amount, t.description_norm
        FROM transactions t
        JOIN accounts a ON a.id = t.account_id
        WHERE a.type = 'bank'
          AND t.description_norm LIKE '%CARD%PAYMENT%'
          {where}
        """,
        params,
    ).fetchall()

    card_transactions = conn.execute(
        """
        SELECT t.id, t.posted_at, t.amount
        FROM transactions t
        JOIN accounts a ON a.id = t.account_id
        WHERE a.type = 'card'
        """
    ).fetchall()

    for payment in bank_payments:
        payment_date = datetime.fromisoformat(payment["posted_at"])
        window_start = (payment_date - timedelta(days=5)).date().isoformat()
        window_end = (payment_date + timedelta(days=5)).date().isoformat()
        matches = [
            tx
            for tx in card_transactions
            if window_start <= tx["posted_at"] <= window_end
            and abs(abs(tx["amount"]) - abs(payment["amount"])) < 0.01
        ]
        for match in matches:
            conn.execute(
                """
                INSERT OR IGNORE INTO transaction_links
                (source_transaction_id, target_transaction_id, link_type)
                VALUES (?, ?, 'card_payment')
                """,
                (payment["id"], match["id"]),
            )


def find_potential_transfers(conn, days_window: int = 7) -> List[Dict]:
    """
    Find potential internal transfers that aren't already linked.
    Returns pairs of transactions that:
    - Are on different accounts
    - Have opposite signs (one debit, one credit)
    - Have matching amounts (or very close)
    - Are within a date window
    """
    # Get all transactions not already linked
    all_txs = conn.execute(
        """
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
        ORDER BY t.posted_at DESC
    """
    ).fetchall()

    # Get ignored pairs to filter them out
    ignored_rows = conn.execute(
        "SELECT source_transaction_id, target_transaction_id FROM transaction_links WHERE link_type = 'ignored'"
    ).fetchall()
    ignored_pairs = {
        tuple(sorted([row["source_transaction_id"], row["target_transaction_id"]]))
        for row in ignored_rows
    }

    potential_pairs = []
    checked_pairs = set()

    for tx1 in all_txs:
        tx1_date = datetime.fromisoformat(tx1["posted_at"])
        
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
            if tx1["amount"] * tx2["amount"] >= 0:  # Same sign
                continue
            
            # Check if amounts match (within 1%)
            amount_diff = abs(abs(tx1["amount"]) - abs(tx2["amount"]))
            if amount_diff > max(1, abs(tx1["amount"]) * 0.01):
                continue
            
            # Check if within date window
            tx2_date = datetime.fromisoformat(tx2["posted_at"])
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
                    "amount": abs(source["amount"]),
                })
    
    # Sort by confidence, then amount
    potential_pairs.sort(key=lambda x: (-x["confidence"], -x["amount"]))
    return potential_pairs[:50]  # Limit to top 50


def calculate_transfer_confidence(tx1: Dict, tx2: Dict) -> int:
    """Calculate confidence score (0-100) that two transactions are an internal transfer."""
    score = 50  # Base score for matching amount + opposite signs + date proximity
    
    # Exact amount match
    if abs(tx1["amount"]) == abs(tx2["amount"]):
        score += 15
    
    # Same day
    if tx1["posted_at"][:10] == tx2["posted_at"][:10]:
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


def auto_categorize_linked_transfers(conn) -> int:
    """
    Categorize linked transactions as Transfers.
    Returns count of transactions updated.
    """
    # Get the Transfers category and Credit Card Payment subcategory
    transfers_cat = conn.execute(
        "SELECT id FROM categories WHERE name = 'Transfers'"
    ).fetchone()
    
    if not transfers_cat:
        return 0
    
    cc_payment_sub = conn.execute(
        "SELECT id FROM subcategories WHERE category_id = ? AND name LIKE '%Credit Card%'",
        (transfers_cat["id"],)
    ).fetchone()
    
    subcat_id = cc_payment_sub["id"] if cc_payment_sub else None
    
    # Update all linked transactions
    result = conn.execute(
        """
        UPDATE transactions
        SET category_id = ?, subcategory_id = ?, is_uncertain = 0
        WHERE id IN (
            SELECT source_transaction_id FROM transaction_links WHERE link_type != 'ignored'
            UNION
            SELECT target_transaction_id FROM transaction_links WHERE link_type != 'ignored'
        )
        AND (category_id IS NULL OR category_id != ?)
        """,
        (transfers_cat["id"], subcat_id, transfers_cat["id"])
    )
    conn.commit()
    return result.rowcount
