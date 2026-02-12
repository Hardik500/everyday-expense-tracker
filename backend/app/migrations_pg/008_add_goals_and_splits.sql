-- Migration 008: Add goals, transaction splits, and net worth tracking tables (PostgreSQL)

-- Goals/Savings Tracking Table
CREATE TABLE IF NOT EXISTS goals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    target_amount NUMERIC(12,2) NOT NULL,
    current_amount NUMERIC(12,2) DEFAULT 0,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    deadline DATE,
    icon TEXT,
    color TEXT DEFAULT '#6366f1',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_deadline ON goals(deadline);

-- Transaction Splits Table (for multi-category transactions)
CREATE TABLE IF NOT EXISTS transaction_splits (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    subcategory_id INTEGER REFERENCES subcategories(id) ON DELETE SET NULL,
    amount NUMERIC(12,2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_splits_transaction_id ON transaction_splits(transaction_id);
CREATE INDEX IF NOT EXISTS idx_splits_user_id ON transaction_splits(user_id);

-- Net Worth History Table
CREATE TABLE IF NOT EXISTS net_worth_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recorded_at DATE NOT NULL,
    total_assets NUMERIC(12,2) DEFAULT 0,
    total_liabilities NUMERIC(12,2) DEFAULT 0,
    net_worth NUMERIC(12,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_networth_user_date ON net_worth_history(user_id, recorded_at);

-- Duplicate Transactions Tracking
CREATE TABLE IF NOT EXISTS duplicate_pairs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    duplicate_transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    similarity_score NUMERIC(3,2) DEFAULT 1.0,
    status TEXT DEFAULT 'pending', -- 'pending', 'confirmed_duplicate', 'not_duplicate'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_duplicates_user_id ON duplicate_pairs(user_id);
CREATE INDEX IF NOT EXISTS idx_duplicates_status ON duplicate_pairs(status);