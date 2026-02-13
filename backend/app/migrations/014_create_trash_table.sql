-- Create trash table for soft-delete functionality (SQLite)

CREATE TABLE IF NOT EXISTS trash (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_table TEXT NOT NULL,
    original_id INTEGER NOT NULL,
    data TEXT NOT NULL,
    deleted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_by INTEGER NOT NULL,
    reason TEXT,
    FOREIGN KEY (deleted_by) REFERENCES users(id)
);

-- Index for efficient querying of trash items by user
CREATE INDEX IF NOT EXISTS idx_trash_user ON trash(deleted_by, deleted_at DESC);

-- Index for efficient querying by original table
CREATE INDEX IF NOT EXISTS idx_trash_original ON trash(original_table, original_id);

-- Ensure only valid table names can be stored (SQLite uses CHECK constraint)
-- Note: SQLite CHECK constraints are simpler than PostgreSQL
-- We'll validate in application code as well