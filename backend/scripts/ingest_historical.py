import sys
import os
import sqlite3
from pathlib import Path

# Add backend to sys.path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.db import get_conn
from app.ingest.pdf import ingest_pdf
from app.ingest.csv import ingest_csv
from app.rules.engine import apply_rules

# Account Mappings
ACCOUNTS = {
    'moneyback': 7,
    'millenia': 8,
    'regallia': 2,
    '5391': 7, # Assuming 5391 is Moneyback+ based on user upgrade path
    '1218': 8, # Assuming 1218 is Millenia
    '3005': 2  # Assuming 3005 is Regalia Gold
}

STATEMENTS_DIR = Path('statements')

def get_or_create_statement(conn, account_id, file_name):
    row = conn.execute(
        "SELECT id FROM statements WHERE account_id = ? AND file_name = ?",
        (account_id, file_name)
    ).fetchone()
    if row:
        return row['id']
    
    cursor = conn.execute(
        "INSERT INTO statements (account_id, source, file_name, imported_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
        (account_id, 'historical_script', file_name)
    )
    return cursor.lastrowid

def main():
    conn = get_conn()
    files = sorted(STATEMENTS_DIR.glob('*'))
    
    for f in files:
        if f.suffix.lower() == '.identifier': continue
        
        account_id = None
        fname_lower = f.name.lower()
        
        if 'moneyback' in fname_lower:
            account_id = ACCOUNTS['moneyback']
        elif 'millenia' in fname_lower:
            account_id = ACCOUNTS['millenia']
        elif 'regallia' in fname_lower or 'regalia' in fname_lower:
            account_id = ACCOUNTS['regallia']
        elif '5391' in f.name:
            account_id = ACCOUNTS['5391']
        elif '1218' in f.name:
            account_id = ACCOUNTS['1218']
        elif '3005' in f.name:
            account_id = ACCOUNTS['3005']
        
        if not account_id:
            # HDFC Savings for Acct_Statement files
            if 'acct_statement' in fname_lower or '4651' in f.name:
                account_id = 6  # HDFC Savings
            elif 'hdfc' in fname_lower:
                account_id = 6 # Savings
            else:
                print(f"Skipping unknown file: {f.name}")
                continue
        
        print(f"Processing {f.name} for account {account_id}...")
        
        statement_id = get_or_create_statement(conn, account_id, f.name)
        content = f.read_bytes()
        
        try:
            if f.suffix.lower() == '.pdf':
                inserted, skipped = ingest_pdf(conn, account_id, statement_id, content)
            elif f.suffix.lower() == '.csv':
                inserted, skipped = ingest_csv(conn, account_id, statement_id, content, profile='generic')
            elif f.suffix.lower() == '.txt':
                # HDFC savings account TXT statements
                inserted, skipped = ingest_csv(conn, account_id, statement_id, content, profile='hdfc_txt')
            else:
                print(f"Format not supported for auto-import: {f.suffix}")
                continue
                
            print(f"  Inserted: {inserted}, Skipped: {skipped}")
            conn.commit()
            
            if inserted > 0:
                apply_rules(conn, account_id)
                conn.commit()
        except Exception as e:
            print(f"  Error processing {f.name}: {e}")
            conn.rollback()

if __name__ == '__main__':
    main()
