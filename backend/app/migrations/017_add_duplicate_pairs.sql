-- Migration: 017_add_duplicate_pairs
-- Creates table for storing duplicate transaction pairs

CREATE TABLE IF NOT EXISTS duplicate_pairs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    original_transaction_id INTEGER NOT NULL,
    duplicate_transaction_id INTEGER NOT NULL,
    similarity_score REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (original_transaction_id) REFERENCES transactions(id),
    FOREIGN KEY (duplicate_transaction_id) REFERENCES transactions(id)
);

CREATE INDEX IF NOT EXISTS idx_duplicate_pairs_user ON duplicate_pairs(user_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_pairs_original ON duplicate_pairs(original_transaction_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_pairs_duplicate ON duplicate_pairs(duplicate_transaction_id);
