import sys
import os

# Set working directory to backend
sys.path.insert(0, os.path.join(os.getcwd(), 'backend'))

from app.db import get_conn

with get_conn() as conn:
    imports = conn.execute("SELECT id, sender, subject, status, error_message, created_at FROM email_imports ORDER BY id DESC LIMIT 5").fetchall()
    print(f"Found {len(imports)} recent email imports:")
    for imp in imports:
        print(dict(imp))
        
    missing = conn.execute("SELECT id, reason, created_at FROM missing_statements ORDER BY id DESC LIMIT 5").fetchall()
    print(f"Found {len(missing)} recent missing statements:")
    for m in missing:
        print(dict(m))

    users = conn.execute("SELECT id, username, email, gmail_enabled, gmail_last_sync FROM users").fetchall()
    print("Users:")
    for u in users:
        print(dict(u))
