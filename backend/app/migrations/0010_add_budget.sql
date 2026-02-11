-- Add budget field to categories table
ALTER TABLE categories ADD COLUMN monthly_budget REAL DEFAULT NULL;

-- Create table for budget alerts
CREATE TABLE IF NOT EXISTS budget_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    threshold_percent INTEGER NOT NULL DEFAULT 80,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(category_id) REFERENCES categories(id),
    UNIQUE(user_id, category_id)
);
