import time
import base64
from datetime import datetime, timezone
from app.db import get_conn
from app.gmail import get_gmail_service
from app.ingest.csv import ingest_csv
from app.ingest.ofx import ingest_ofx
from app.ingest.pdf import ingest_pdf
from app.ingest.xls import ingest_xls
from app.rules.engine import apply_rules
from app.linking import link_card_payments
from app.accounts.discovery import detect_account

def process_user_sync(conn, user):
    """Sync Gmail for a single user."""
    user_id = user["id"]
    refresh_token = user["gmail_refresh_token"]
    query = user["gmail_filter_query"] or "has:attachment filename:(pdf OR ofx OR xls OR csv)"
    last_sync = user["gmail_last_sync"]
    
    print(f"Starting Gmail sync for user {user_id} ({user['username']})")
    
    try:
        service = get_gmail_service(refresh_token)
        
        # Build query with time constraint if available
        if last_sync:
            # last_sync might be a string or datetime
            if isinstance(last_sync, str):
                try:
                    last_sync = datetime.fromisoformat(last_sync.replace('Z', '+00:00'))
                except ValueError:
                    pass
            
            if isinstance(last_sync, datetime):
                # Convert to unix timestamp for Gmail query 'after:X'
                ts = int(last_sync.timestamp())
                query = f"{query} after:{ts}"
        
        results = service.users().messages().list(userId='me', q=query).execute()
        messages = results.get('messages', [])
        
        if not messages:
            print(f"No new messages for user {user_id}")
            return
            
        print(f"Found {len(messages)} potential messages for user {user_id}")
        
        for msg in messages:
            msg_data = service.users().messages().get(userId='me', id=msg['id']).execute()
            parts = msg_data.get('payload', {}).get('parts', [])
            
            for part in parts:
                if part.get('filename'):
                    attachment_id = part['body'].get('attachmentId')
                    if not attachment_id:
                        continue
                        
                    attachment = service.users().messages().attachments().get(
                        userId='me', messageId=msg['id'], id=attachment_id
                    ).execute()
                    
                    data = base64.urlsafe_b64decode(attachment['data'].encode('UTF-8'))
                    filename = part['filename']
                    
                    print(f"Processing attachment: {filename}")
                    
                    # Detect which account this belongs to
                    account_suggestion = detect_account(conn, filename, data, user_id=user_id)
                    account_id = account_suggestion.get("account_id")
                    
                    if not account_id:
                        print(f"Skipping {filename}: Could not determine account.")
                        continue
                        
                    # Determine source type
                    ext = filename.split('.')[-1].lower()
                    source = None
                    if ext == 'pdf': source = 'pdf'
                    elif ext in ['ofx', 'qfx']: source = 'ofx'
                    elif ext in ['xls', 'xlsx']: source = 'xls'
                    elif ext in ['csv', 'txt']: source = 'csv'
                    
                    if not source:
                        continue
                        
                    # Start Ingestion
                    cursor = conn.execute(
                        "INSERT INTO statements (account_id, source, file_name, user_id) VALUES (?, ?, ?, ?)",
                        (account_id, source, filename, user_id),
                    )
                    statement_id = cursor.lastrowid
                    
                    inserted, skipped = 0, 0
                    if source == "csv":
                        inserted, skipped = ingest_csv(conn, account_id, statement_id, data, user_id=user_id)
                    elif source == "xls":
                        inserted, skipped = ingest_xls(conn, account_id, statement_id, data, user_id=user_id)
                    elif source == "pdf":
                        inserted, skipped = ingest_pdf(conn, account_id, statement_id, data, user_id=user_id)
                    elif source == "ofx":
                        inserted, skipped = ingest_ofx(conn, account_id, statement_id, data, user_id=user_id)
                        
                    if inserted > 0:
                        print(f"Successfully ingested {inserted} transactions from {filename}")
                        apply_rules(conn, account_id=account_id, statement_id=statement_id, user_id=user_id)
                        link_card_payments(conn, account_id=account_id, user_id=user_id)
                    else:
                        print(f"All transactions in {filename} were duplicates (skipped {skipped})")
        
        # Update last sync time
        conn.execute(
            "UPDATE users SET gmail_last_sync = ? WHERE id = ?",
            (datetime.now(timezone.utc).isoformat(), user_id)
        )
        conn.commit()
        
    except Exception as e:
        print(f"Error syncing Gmail for user {user_id}: {e}")

def run_worker():
    """Main worker loop."""
    print("Gmail Sync Worker started.")
    while True:
        try:
            with get_conn() as conn:
                # Find users with Gmail enabled
                users = conn.execute("SELECT * FROM users WHERE gmail_enabled = TRUE").fetchall()
                for user in users:
                    process_user_sync(conn, user)
        except Exception as e:
            print(f"Worker iteration failed: {e}")
            
        # Poll every 4 hours (14400 seconds)
        print("Worker sleeping for 4 hours...")
        time.sleep(14400)

if __name__ == "__main__":
    run_worker()
