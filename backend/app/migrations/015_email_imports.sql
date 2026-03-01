-- Migration: Add email import tracking and missing statements

-- email_imports: tracks every Gmail message processed by the worker
CREATE TABLE IF NOT EXISTS email_imports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    gmail_message_id TEXT NOT NULL,
    sender TEXT,
    subject TEXT,
    received_at TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'processing',
    error_message TEXT,
    attachments_found INTEGER DEFAULT 0,
    transactions_imported INTEGER DEFAULT 0,
    transactions_skipped INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, gmail_message_id)
);

-- missing_statements: emails where no valid attachment was found
CREATE TABLE IF NOT EXISTS missing_statements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    email_import_id INTEGER REFERENCES email_imports(id),
    sender TEXT,
    subject TEXT,
    received_at TIMESTAMP,
    reason TEXT NOT NULL DEFAULT 'no_attachment',
    resolved INTEGER DEFAULT 0,
    resolved_statement_id INTEGER REFERENCES statements(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Link statements to their source email and store Supabase Storage path
ALTER TABLE statements ADD COLUMN gmail_message_id TEXT;
ALTER TABLE statements ADD COLUMN storage_path TEXT;
