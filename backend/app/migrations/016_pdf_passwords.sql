CREATE TABLE IF NOT EXISTS pdf_passwords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, label, value)
);

-- SQLite does not support ADD COLUMN IF NOT EXISTS directly in ALER TABLE.
-- We will just add the column. If the migration rerun fails, the Python migration runner handles it via 'duplicate column name' exception catching.
ALTER TABLE users ADD COLUMN onboarding_completed INTEGER DEFAULT 0;
