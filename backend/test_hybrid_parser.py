#!/usr/bin/env python3
"""
Test hybrid parser approach with DB tracking.

Usage:
    cd /home/openclaw/.openclaw/workspace/everyday-expense-tracker/backend
    source venv/bin/activate
    DATABASE_URL=sqlite:///./data/expense.db python test_hybrid_parser.py
"""

import os
import sys

# Set database URL for testing
os.environ['DATABASE_URL'] = 'sqlite:///./data/test_hybrid.db'

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db import get_conn, apply_migrations
from app.ingest.pdf import ingest_pdf
import tempfile

# Ensure data directory exists
os.makedirs('./data', exist_ok=True)

# Apply migrations first (to add parser tracking columns)
print("Applying migrations...")
apply_migrations()

# Create test account
with get_conn() as conn:
    conn.execute(
        "INSERT OR IGNORE INTO accounts (name, type) VALUES (?, ?)",
        ("Test PDF Account", "credit_card")
    )
    conn.commit()
    
    account = conn.execute(
        "SELECT id FROM accounts WHERE name = ?", ("Test PDF Account",)
    ).fetchone()
    account_id = account["id"]
    user_id = 1

print(f"Using account_id: {account_id}")

# Test files
TEST_FILES = [
    "/home/openclaw/.openclaw/workspace/pdf-to-excel-parser/tests/test_statements/Acct_Statement_XXXXXXXX4651_08022026_unlocked.pdf",
]

for filepath in TEST_FILES:
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        continue
    
    filename = os.path.basename(filepath)
    print(f"\n{'='*60}")
    print(f"Testing: {filename}")
    print(f"{'='*60}\n")
    
    # Create statement record
    with get_conn() as conn:
        cursor = conn.execute(
            "INSERT INTO statements (account_id, source, file_name) VALUES (?, ?, ?)",
            (account_id, "file", filename)
        )
        # Get the last inserted ID
        if hasattr(cursor, 'lastrowid') and cursor.lastrowid:
            statement_id = cursor.lastrowid
        else:
            # For PostgreSQL, need to fetch the ID
            result = conn.execute(
                "SELECT id FROM statements WHERE account_id = ? AND file_name = ? ORDER BY id DESC LIMIT 1",
                (account_id, filename)
            ).fetchone()
            statement_id = result["id"] if result else None
        
        conn.commit()
    
    if not statement_id:
        print("Failed to create statement record")
        continue
    
    print(f"Created statement_id: {statement_id}")
    
    # Read PDF
    with open(filepath, 'rb') as f:
        payload = f.read()
    
    # Process with hybrid parser
    inserted, skipped = ingest_pdf(get_conn(), account_id, statement_id, payload, user_id)
    
    # Check what was recorded
    with get_conn() as conn:
        result = conn.execute(
            """
            SELECT id, file_name, parser, parser_version, 
                   transactions_found, transactions_inserted, parser_error
            FROM statements 
            WHERE id = ?
            """,
            (statement_id,)
        ).fetchone()
        
        if result:
            print(f"\n{'='*60}")
            print("STATEMENT RECORD:")
            print(f"{'='*60}")
            print(f"ID: {result['id']}")
            print(f"File: {result['file_name']}")
            print(f"Parser Used: {result['parser']} (v{result['parser_version']})")
            print(f"Transactions Found: {result['transactions_found']}")
            print(f"Transactions Inserted: {result['transactions_inserted']}")
            print(f"Error: {result['parser_error'] or 'None'}")
            print(f"{'='*60}\n")

print("\n✅ Test complete!")
print("\nCheck your database - the statements table now tracks:")
print("  - parser: which parser was used ('statement-parser' or 'legacy')")
print("  - transactions_found: total found by parser")
print("  - transactions_inserted: successfully inserted")
print("  - parser_error: any error messages")
