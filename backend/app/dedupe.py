def is_duplicate(conn, account_id: int, tx_hash: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM transactions WHERE account_id = ? AND hash = ?",
        (account_id, tx_hash),
    ).fetchone()
    return row is not None
