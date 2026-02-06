-- Learning Patterns table
-- Stores successful parsing patterns to reduce AI calls on similar future statements

CREATE TABLE IF NOT EXISTS learning_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    card_type TEXT NOT NULL,
    date_pattern TEXT,
    amount_pattern TEXT,
    description_sample TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_learning_patterns_user ON learning_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_patterns_card_type ON learning_patterns(card_type);
