-- Migration: Add backup metadata and transaction tags support
-- Feature 13: Data Backup/Restore
-- Feature 16: Smart Tags

-- Add backup metadata table
CREATE TABLE IF NOT EXISTS backup_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    backup_version TEXT NOT NULL DEFAULT '1.0',
    exported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    transaction_count INTEGER NOT NULL DEFAULT 0,
    category_count INTEGER NOT NULL DEFAULT 0,
    file_size_bytes INTEGER,
    CHECK (backup_version IN ('1.0', '1.1', '2.0'))
);

-- Add tags table for Feature 16: Smart Tags
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3b82f6',
    description TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
);

-- Add transaction_tags junction table
CREATE TABLE IF NOT EXISTS transaction_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(transaction_id, tag_id),
    FOREIGN KEY(transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Add transaction templates table for Feature 17
CREATE TABLE IF NOT EXISTS transaction_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description_pattern TEXT,
    amount REAL,
    is_amount_fixed INTEGER DEFAULT 0,
    category_id INTEGER,
    subcategory_id INTEGER,
    account_id INTEGER,
    tags TEXT, -- JSON array of tag IDs
    icon TEXT,
    color TEXT,
    is_active INTEGER DEFAULT 1,
    use_count INTEGER DEFAULT 0,
    last_used_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(category_id) REFERENCES categories(id),
    FOREIGN KEY(subcategory_id) REFERENCES subcategories(id),
    FOREIGN KEY(account_id) REFERENCES accounts(id)
);

-- Add duplicate detection metadata for Feature 14
CREATE TABLE IF NOT EXISTS duplicate_review_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    duplicate_group_id TEXT NOT NULL,
    transaction_ids TEXT NOT NULL, -- JSON array of transaction IDs
    confidence_score REAL NOT NULL, -- 0.0 to 1.0
    detection_reason TEXT NOT NULL, -- 'amount_date', 'description', 'hash', etc.
    status TEXT DEFAULT 'pending', -- 'pending', 'merged', 'dismissed', 'false_positive'
    reviewed_at TEXT,
    reviewed_by_user_id INTEGER,
    kept_transaction_id INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(kept_transaction_id) REFERENCES transactions(id)
);

-- Add index for duplicate detection
CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(hash);
CREATE INDEX IF NOT EXISTS idx_transactions_amount_date ON transactions(amount, posted_at);

-- Add archived transactions table for Feature 15
CREATE TABLE IF NOT EXISTS archived_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_transaction_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    account_id INTEGER NOT NULL,
    posted_at TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL,
    description_raw TEXT NOT NULL,
    description_norm TEXT NOT NULL,
    category_id INTEGER,
    subcategory_id INTEGER,
    notes TEXT,
    archived_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archive_reason TEXT DEFAULT 'old_data'
);

-- Create indexes for archived transactions
CREATE INDEX IF NOT EXISTS idx_archived_user_date ON archived_transactions(user_id, posted_at);
CREATE INDEX IF NOT EXISTS idx_archived_original_id ON archived_transactions(original_transaction_id);

-- Add split transactions support for Feature 18
CREATE TABLE IF NOT EXISTS split_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_transaction_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    subcategory_id INTEGER,
    amount REAL NOT NULL,
    description TEXT,
    percentage REAL, -- Optional: store percentage of parent
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(parent_transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY(category_id) REFERENCES categories(id),
    FOREIGN KEY(subcategory_id) REFERENCES subcategories(id)
);

CREATE INDEX IF NOT EXISTS idx_split_parent ON split_transactions(parent_transaction_id);

-- Add scheduled transactions for Feature 19
CREATE TABLE IF NOT EXISTS scheduled_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    amount REAL NOT NULL,
    is_income INTEGER DEFAULT 0, -- 0 = expense, 1 = income
    currency TEXT DEFAULT 'INR',
    category_id INTEGER,
    subcategory_id INTEGER,
    account_id INTEGER,
    frequency TEXT NOT NULL, -- 'once', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'
    start_date TEXT NOT NULL,
    end_date TEXT, -- NULL for no end
    next_run_date TEXT NOT NULL,
    last_run_date TEXT,
    reminder_days INTEGER DEFAULT 3, -- Days before to remind
    is_active INTEGER DEFAULT 1,
    auto_confirm INTEGER DEFAULT 0, -- If 1, auto-creates transaction without review
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(category_id) REFERENCES categories(id),
    FOREIGN KEY(subcategory_id) REFERENCES subcategories(id),
    FOREIGN KEY(account_id) REFERENCES accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_scheduled_next_run ON scheduled_transactions(next_run_date, is_active);
CREATE INDEX IF NOT EXISTS idx_scheduled_user ON scheduled_transactions(user_id, is_active);

-- Add savings goals for Feature 20
CREATE TABLE IF NOT EXISTS savings_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    target_amount REAL NOT NULL,
    current_amount REAL DEFAULT 0,
    currency TEXT DEFAULT 'INR',
    deadline TEXT, -- Optional deadline
    icon TEXT DEFAULT 'target',
    color TEXT DEFAULT '#10b981',
    category_id INTEGER, -- Optional: link to specific spending category to save from
    auto_save_percentage REAL, -- Optional: auto-save % of income
    is_active INTEGER DEFAULT 1,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(category_id) REFERENCES categories(id)
);

CREATE INDEX IF NOT EXISTS idx_goals_user ON savings_goals(user_id, is_active);

-- Add savings goal contributions
CREATE TABLE IF NOT EXISTS savings_goal_contributions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    source TEXT DEFAULT 'manual', -- 'manual', 'auto', 'transaction_link'
    transaction_id INTEGER,
    contributed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(goal_id) REFERENCES savings_goals(id) ON DELETE CASCADE,
    FOREIGN KEY(transaction_id) REFERENCES transactions(id)
);

CREATE INDEX IF NOT EXISTS idx_goal_contributions ON savings_goal_contributions(goal_id);

-- Add tax categories for Feature 30
CREATE TABLE IF NOT EXISTS tax_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    tax_deductible INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
);

-- Link categories to tax categories
ALTER TABLE categories ADD COLUMN tax_category_id INTEGER DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_categories_tax ON categories(tax_category_id);
