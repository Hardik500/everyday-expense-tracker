-- AI Category Suggestions table
-- Stores suggested categories/subcategories from AI that need user approval

CREATE TABLE IF NOT EXISTS ai_suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL,
    suggested_category TEXT NOT NULL,
    suggested_subcategory TEXT,
    existing_category_id INTEGER,  -- NULL if new category suggested
    existing_subcategory_id INTEGER,  -- NULL if new subcategory suggested
    regex_pattern TEXT,
    confidence TEXT DEFAULT 'medium',  -- low, medium, high
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, approved, rejected
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TEXT,
    FOREIGN KEY(transaction_id) REFERENCES transactions(id),
    FOREIGN KEY(existing_category_id) REFERENCES categories(id),
    FOREIGN KEY(existing_subcategory_id) REFERENCES subcategories(id)
);

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_status ON ai_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_transaction ON ai_suggestions(transaction_id);
