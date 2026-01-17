import sqlite3
import hashlib
import os

db_path = "/home/hardik/projects/expense-tracker/backend/data/expense.db"

def compute_hash(posted_at, amount, description_norm):
    payload = f"{posted_at}|{amount:.2f}|{description_norm}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()

def cleanup():
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    
    # 1. Recalculate all hashes globally (without account_id)
    print("Recalculating all hashes...")
    txns = conn.execute("SELECT id, posted_at, amount, description_norm FROM transactions").fetchall()
    for tx in txns:
        new_hash = compute_hash(tx["posted_at"], tx["amount"], tx["description_norm"])
        conn.execute("UPDATE transactions SET hash = ? WHERE id = ?", (new_hash, tx["id"]))
    conn.commit()
    
    # 2. Identify duplicates
    print("Identifying duplicates...")
    duplicates = conn.execute("""
        SELECT hash, COUNT(*) as cnt, GROUP_CONCAT(id) as ids, GROUP_CONCAT(account_id) as accts
        FROM transactions
        GROUP BY hash
        HAVING cnt > 1
    """).fetchall()
    
    deleted_count = 0
    for dup in duplicates:
        ids = [int(x) for x in dup["ids"].split(",")]
        accts = [int(x) for x in dup["accts"].split(",")]
        
        # Priority: Keep the one in Regalia (2) or Card account, delete from Moneyback (7) if it's a "ghost"
        # If one is account 2 and one is account 7, delete 7
        if 2 in accts and 7 in accts:
            idx_7 = accts.index(7)
            id_to_delete = ids[idx_7]
            conn.execute("DELETE FROM transactions WHERE id = ?", (id_to_delete,))
            deleted_count += 1
        else:
            # For others, keep the first one inserted (lowest ID)
            to_keep = min(ids)
            for id_val in ids:
                if id_val != to_keep:
                    conn.execute("DELETE FROM transactions WHERE id = ?", (id_val,))
                    deleted_count += 1
            
    conn.commit()
    print(f"Cleanup complete. Deleted {deleted_count} duplicates.")
    conn.close()

if __name__ == "__main__":
    cleanup()
