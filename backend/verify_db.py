import sqlite3
import os

db_path = "/home/hardik/projects/expense-tracker/backend/expense_tracker.db"

def check_db():
    if not os.path.exists(db_path):
        print(f"Error: Database {db_path} not found.")
        return

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    
    print("--- Users Table ---")
    users = conn.execute("SELECT id, username, full_name FROM users").fetchall()
    for u in users:
        print(f"ID: {u['id']}, Username: {u['username']}, Name: {u['full_name']}")
    
    if users:
        alice_id = next((u['id'] for u in users if u['username'] == 'alice'), None)
        bob_id = next((u['id'] for u in users if u['username'] == 'bob'), None)
        
        if alice_id:
            print("\n--- Alice Data Counts ---")
            tables = ['accounts', 'transactions', 'categories', 'subcategories', 'rules']
            for table in tables:
                count = conn.execute(f"SELECT COUNT(*) as cnt FROM {table} WHERE user_id = ?", (alice_id,)).fetchone()['cnt']
                print(f"{table}: {count}")
        
        if bob_id:
            print("\n--- Bob Data Counts ---")
            tables = ['accounts', 'transactions', 'categories', 'subcategories', 'rules']
            for table in tables:
                count = conn.execute(f"SELECT COUNT(*) as cnt FROM {table} WHERE user_id = ?", (bob_id,)).fetchone()['cnt']
                print(f"{table}: {count}")
    
    conn.close()

if __name__ == "__main__":
    check_db()
