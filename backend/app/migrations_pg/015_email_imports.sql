-- Migration: Add email import tracking and missing statements (PostgreSQL)

-- email_imports: tracks every Gmail message processed by the worker
CREATE TABLE IF NOT EXISTS email_imports (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    gmail_message_id VARCHAR(255) NOT NULL,
    sender TEXT,
    subject TEXT,
    received_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'processing',
    error_message TEXT,
    attachments_found INTEGER DEFAULT 0,
    transactions_imported INTEGER DEFAULT 0,
    transactions_skipped INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, gmail_message_id)
);

-- missing_statements: emails where no valid attachment was found
CREATE TABLE IF NOT EXISTS missing_statements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    email_import_id INTEGER REFERENCES email_imports(id),
    sender TEXT,
    subject TEXT,
    received_at TIMESTAMP WITH TIME ZONE,
    reason VARCHAR(50) NOT NULL DEFAULT 'no_attachment',
    resolved BOOLEAN DEFAULT FALSE,
    resolved_statement_id INTEGER REFERENCES statements(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Link statements to their source email and store Supabase Storage path
ALTER TABLE statements ADD COLUMN IF NOT EXISTS gmail_message_id TEXT;
ALTER TABLE statements ADD COLUMN IF NOT EXISTS storage_path TEXT;
