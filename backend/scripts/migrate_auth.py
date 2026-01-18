import sqlite3
import os

DB_PATH = 'data/expense.db'

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # 1. Create users table
        print("Creating users table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                email TEXT UNIQUE,
                full_name TEXT,
                disabled BOOLEAN DEFAULT FALSE,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 2. Add user_id to existing tables
        tables = [
            'accounts', 'transactions', 'categories', 'subcategories', 
            'rules', 'statements', 'ai_suggestions', 'transaction_links', 'mappings'
        ]

        for table in tables:
            # Check if user_id already exists
            cursor.execute(f"PRAGMA table_info({table})")
            columns = [row[1] for row in cursor.fetchall()]
            
            if 'user_id' not in columns:
                print(f"Adding user_id to {table}...")
                # SQLite doesn't support adding FK in ALTER TABLE easily, 
                # but we can add the column.
                cursor.execute(f"ALTER TABLE {table} ADD COLUMN user_id INTEGER REFERENCES users(id)")
                
                # Add index
                print(f"Creating index for {table}(user_id)...")
                cursor.execute(f"CREATE INDEX IF NOT EXISTS idx_{table}_user_id ON {table}(user_id)")
            else:
                print(f"user_id already exists in {table}")

        conn.commit()
        print("Migration completed successfully!")

    except Exception as e:
        conn.rollback()
        print(f"Migration failed: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
