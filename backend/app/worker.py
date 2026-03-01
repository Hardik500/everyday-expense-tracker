import time
import base64
import logging
import threading
from datetime import datetime, timezone
from app.db import get_conn
from app.gmail import get_gmail_service
from app.ingest.csv import ingest_csv
from app.ingest.ofx import ingest_ofx
from app.ingest.pdf import ingest_pdf
from app.ingest.xls import ingest_xls
from app.rules.engine import apply_rules
from app.linking import link_card_payments
from app.accounts.discovery import detect_statement_account
from app.storage import upload_statement

logger = logging.getLogger(__name__)

# Supported attachment extensions
SUPPORTED_EXTENSIONS = {"pdf", "ofx", "qfx", "xls", "xlsx", "csv", "txt"}

# Track sync state for the status endpoint
_sync_state = {"is_syncing": False, "lock": threading.Lock()}


def is_syncing() -> bool:
    """Check if a sync is currently in progress."""
    return _sync_state["is_syncing"]


def _extract_header(headers: list, name: str) -> str:
    """Extract a header value from Gmail message headers."""
    name_lower = name.lower()
    for header in headers:
        if header.get("name", "").lower() == name_lower:
            return header.get("value", "")
    return ""


def _is_message_processed(conn, user_id: int, gmail_message_id: str) -> bool:
    """Check if a Gmail message has already been successfully processed."""
    row = conn.execute(
        "SELECT id FROM email_imports WHERE user_id = ? AND gmail_message_id = ? AND status = 'success'",
        (user_id, gmail_message_id)
    ).fetchone()
    return row is not None


def _create_email_import(conn, user_id: int, gmail_message_id: str,
                         sender: str, subject: str, received_at: str) -> int:
    """Create an email_imports row and return its ID."""
    cursor = conn.execute(
        """INSERT INTO email_imports
           (user_id, gmail_message_id, sender, subject, received_at, status)
           VALUES (?, ?, ?, ?, ?, 'processing')""",
        (user_id, gmail_message_id, sender, subject, received_at)
    )
    conn.commit()
    return cursor.lastrowid


def _update_email_import(conn, import_id: int, status: str,
                         attachments_found: int = 0,
                         transactions_imported: int = 0,
                         transactions_skipped: int = 0,
                         error_message: str = None):
    """Update the status and counters of an email_imports row."""
    conn.execute(
        """UPDATE email_imports
           SET status = ?, attachments_found = ?,
               transactions_imported = ?, transactions_skipped = ?,
               error_message = ?
           WHERE id = ?""",
        (status, attachments_found, transactions_imported,
         transactions_skipped, error_message, import_id)
    )
    conn.commit()


def _create_missing_statement(conn, user_id: int, email_import_id: int,
                              sender: str, subject: str,
                              received_at: str, reason: str):
    """Record an email as a missing statement for manual resolution."""
    conn.execute(
        """INSERT INTO missing_statements
           (user_id, email_import_id, sender, subject, received_at, reason)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (user_id, email_import_id, sender, subject, received_at, reason)
    )
    conn.commit()


def _get_attachment_source(filename: str):
    """Determine the source type from filename extension. Returns None if unsupported."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext == "pdf":
        return "pdf"
    elif ext in ("ofx", "qfx"):
        return "ofx"
    elif ext in ("xls", "xlsx"):
        return "xls"
    elif ext in ("csv", "txt"):
        return "csv"
    return None


def process_user_sync(conn, user):
    """Sync Gmail for a single user with full email tracking."""
    user_id = user["id"]
    refresh_token = user["gmail_refresh_token"]
    query = user["gmail_filter_query"] or "has:attachment filename:(pdf OR ofx OR xls OR csv)"
    last_sync = user["gmail_last_sync"]

    print(f"Starting Gmail sync for user {user_id} ({user['username']})")

    service = None
    try:
        service = get_gmail_service(refresh_token)

        # Build query with time constraint if available
        if last_sync:
            if isinstance(last_sync, str):
                try:
                    last_sync = datetime.fromisoformat(last_sync.replace('Z', '+00:00'))
                except ValueError:
                    pass

            if isinstance(last_sync, datetime):
                ts = int(last_sync.timestamp())
                query = f"{query} after:{ts}"

        results = service.users().messages().list(userId='me', q=query).execute()
        messages = results.get('messages', [])

        if not messages:
            print(f"No new messages for user {user_id}")
            return

        print(f"Found {len(messages)} potential messages for user {user_id}")

        for msg in messages:
            gmail_message_id = msg['id']

            # ── Dedup: skip already-processed messages ──
            if _is_message_processed(conn, user_id, gmail_message_id):
                print(f"Skipping already processed message {gmail_message_id}")
                continue

            msg_data = service.users().messages().get(userId='me', id=gmail_message_id).execute()
            headers = msg_data.get('payload', {}).get('headers', [])

            # ── Extract email metadata ──
            sender = _extract_header(headers, "From")
            subject = _extract_header(headers, "Subject")
            date_str = _extract_header(headers, "Date")

            # Parse received date
            received_at = None
            if date_str:
                try:
                    from email.utils import parsedate_to_datetime
                    received_at = parsedate_to_datetime(date_str).isoformat()
                except Exception:
                    received_at = date_str

            # ── Create email import record ──
            import_id = _create_email_import(
                conn, user_id, gmail_message_id,
                sender, subject, received_at
            )

            try:
                parts = msg_data.get('payload', {}).get('parts', [])
                # Also check for attachments in nested parts
                all_parts = list(parts)
                for part in parts:
                    nested = part.get('parts', [])
                    all_parts.extend(nested)

                # Find valid attachments
                attachment_parts = [
                    p for p in all_parts
                    if p.get('filename') and p['body'].get('attachmentId')
                ]

                if not attachment_parts:
                    # No attachments at all → missing statement
                    _update_email_import(conn, import_id, status='skipped',
                                        error_message='No attachments found')
                    _create_missing_statement(
                        conn, user_id, import_id, sender, subject,
                        received_at, reason='no_attachment'
                    )
                    print(f"No attachments in message {gmail_message_id} from {sender}")
                    continue

                total_imported = 0
                total_skipped = 0
                supported_found = 0

                for part in attachment_parts:
                    filename = part['filename']
                    source = _get_attachment_source(filename)

                    if source is None:
                        continue  # Unsupported extension, skip silently

                    supported_found += 1
                    attachment_id = part['body']['attachmentId']

                    attachment = service.users().messages().attachments().get(
                        userId='me', messageId=gmail_message_id, id=attachment_id
                    ).execute()

                    data = base64.urlsafe_b64decode(attachment['data'].encode('UTF-8'))

                    print(f"Processing attachment: {filename}")

                    # ── Attempt PDF Unlock ──
                    if source == "pdf":
                        from app.ingest.pdf_unlock import try_unlock_pdf
                        try:
                            data = try_unlock_pdf(conn, data, user_id)
                        except ValueError as e:
                            print(f"Failed to unlock encrypted PDF {filename}: {e}")
                            # Record as a missing statement due to password failure
                            _update_email_import(conn, import_id, status='skipped',
                                                error_message=f'Password required for {filename}')
                            _create_missing_statement(
                                conn, user_id, import_id, sender, subject,
                                received_at, reason='password_failed'
                            )
                            continue  # Skip to next attachment or email

                    # Detect which account this belongs to
                    matched_acc = detect_statement_account(conn, filename, data, user_id=user_id)
                    account_id = matched_acc["id"] if matched_acc else None

                    if not account_id:
                        print(f"Skipping {filename}: Could not determine account.")
                        total_skipped += 1
                        continue

                    # Upload to Supabase Storage
                    storage_path = upload_statement(user_id, filename, data)

                    # Create statement record
                    cursor = conn.execute(
                        """INSERT INTO statements
                           (account_id, source, file_name, user_id, gmail_message_id, storage_path)
                           VALUES (?, ?, ?, ?, ?, ?)""",
                        (account_id, source, filename, user_id, gmail_message_id, storage_path),
                    )
                    statement_id = cursor.lastrowid

                    # Run ingestion
                    inserted, skipped = 0, 0
                    if source == "csv":
                        inserted, skipped, _ = ingest_csv(conn, account_id, statement_id, data, user_id=user_id)
                    elif source == "xls":
                        inserted, skipped, _ = ingest_xls(conn, account_id, statement_id, data, user_id=user_id)
                    elif source == "pdf":
                        inserted, skipped = ingest_pdf(conn, account_id, statement_id, data, user_id=user_id)
                    elif source == "ofx":
                        inserted, skipped, _ = ingest_ofx(conn, account_id, statement_id, data, user_id=user_id)

                    total_imported += inserted
                    total_skipped += skipped

                    if inserted > 0:
                        print(f"Successfully ingested {inserted} transactions from {filename}")
                        apply_rules(conn, account_id=account_id, statement_id=statement_id, user_id=user_id)
                        link_card_payments(conn, account_id=account_id, user_id=user_id)
                    else:
                        print(f"All transactions in {filename} were duplicates (skipped {skipped})")

                # Check if we found any supported attachments
                if supported_found == 0:
                    _update_email_import(conn, import_id, status='skipped',
                                        attachments_found=len(attachment_parts),
                                        error_message='No supported file formats found')
                    _create_missing_statement(
                        conn, user_id, import_id, sender, subject,
                        received_at, reason='unsupported_format'
                    )
                else:
                    _update_email_import(
                        conn, import_id, status='success',
                        attachments_found=supported_found,
                        transactions_imported=total_imported,
                        transactions_skipped=total_skipped
                    )

            except Exception as e:
                logger.error(f"Error processing message {gmail_message_id}: {e}")
                _update_email_import(
                    conn, import_id, status='failed',
                    error_message=str(e)[:500]
                )

        # Update last sync time
        conn.execute(
            "UPDATE users SET gmail_last_sync = ? WHERE id = ?",
            (datetime.now(timezone.utc).isoformat(), user_id)
        )
        conn.commit()

    except Exception as e:
        logger.error(f"Error syncing Gmail for user {user_id}: {e}")
    finally:
        # HIGH-004: Properly close Gmail service connection
        if service:
            try:
                if hasattr(service, '_http') and service._http:
                    service._http.close()
            except Exception as close_err:
                logger.warning(f"Error closing Gmail service for user {user_id}: {close_err}")


def run_worker():
    """Main worker loop."""
    print("Gmail Sync Worker started.")
    while True:
        with _sync_state["lock"]:
            _sync_state["is_syncing"] = True
        try:
            with get_conn() as conn:
                # Find users with Gmail enabled
                users = conn.execute("SELECT * FROM users WHERE gmail_enabled = TRUE").fetchall()
                for user in users:
                    process_user_sync(conn, user)
        except Exception as e:
            print(f"Worker iteration failed: {e}")
        finally:
            with _sync_state["lock"]:
                _sync_state["is_syncing"] = False

        # Poll every 4 hours (14400 seconds)
        print("Worker sleeping for 4 hours...")
        time.sleep(14400)


def trigger_sync(user_id: int):
    """
    Trigger an immediate sync for a single user.
    Called from the manual sync API endpoint.
    """
    with _sync_state["lock"]:
        if _sync_state["is_syncing"]:
            return {"status": "already_syncing", "message": "A sync is already in progress."}
        _sync_state["is_syncing"] = True

    try:
        with get_conn() as conn:
            user = conn.execute(
                "SELECT * FROM users WHERE id = ? AND gmail_enabled = TRUE",
                (user_id,)
            ).fetchone()
            if not user:
                return {"status": "error", "message": "Gmail sync not enabled for this user."}

            process_user_sync(conn, user)
            return {"status": "success", "message": "Gmail sync completed."}
    except Exception as e:
        logger.error(f"Manual sync failed for user {user_id}: {e}")
        return {"status": "error", "message": str(e)}
    finally:
        with _sync_state["lock"]:
            _sync_state["is_syncing"] = False


if __name__ == "__main__":
    run_worker()
