-- PostgreSQL Schema for Expense Tracker
-- This is a consolidated migration for fresh PostgreSQL deployments

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    email VARCHAR(255) UNIQUE,
    full_name VARCHAR(255),
    disabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Accounts table
CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('bank', 'card', 'cash')),
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    metadata JSONB DEFAULT '{}',
    upgraded_from_id INTEGER REFERENCES accounts(id),
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Statements table
CREATE TABLE IF NOT EXISTS statements (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    source VARCHAR(50) NOT NULL,
    file_name VARCHAR(500) NOT NULL,
    user_id INTEGER REFERENCES users(id),
    imported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    user_id INTEGER REFERENCES users(id),
    UNIQUE(name, user_id)
);

-- Subcategories table
CREATE TABLE IF NOT EXISTS subcategories (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    name VARCHAR(255) NOT NULL,
    user_id INTEGER REFERENCES users(id),
    UNIQUE(category_id, name, user_id)
);

-- Rules table
CREATE TABLE IF NOT EXISTS rules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    pattern TEXT NOT NULL,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    subcategory_id INTEGER REFERENCES subcategories(id),
    min_amount DECIMAL(15, 2),
    max_amount DECIMAL(15, 2),
    priority INTEGER NOT NULL DEFAULT 50,
    account_type VARCHAR(50),
    merchant_contains TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    user_id INTEGER REFERENCES users(id)
);

-- Mappings table
CREATE TABLE IF NOT EXISTS mappings (
    id SERIAL PRIMARY KEY,
    description_norm TEXT NOT NULL,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    subcategory_id INTEGER REFERENCES subcategories(id),
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(description_norm, user_id)
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    statement_id INTEGER REFERENCES statements(id),
    posted_at DATE NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    description_raw TEXT NOT NULL,
    description_norm TEXT NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    subcategory_id INTEGER REFERENCES subcategories(id),
    is_uncertain BOOLEAN NOT NULL DEFAULT TRUE,
    hash VARCHAR(64) NOT NULL,
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(hash)
);

-- Transaction links table
CREATE TABLE IF NOT EXISTS transaction_links (
    id SERIAL PRIMARY KEY,
    source_transaction_id INTEGER NOT NULL REFERENCES transactions(id),
    target_transaction_id INTEGER NOT NULL REFERENCES transactions(id),
    link_type VARCHAR(50) NOT NULL,
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_transaction_id, target_transaction_id, link_type)
);

-- AI Suggestions table
CREATE TABLE IF NOT EXISTS ai_suggestions (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER NOT NULL REFERENCES transactions(id),
    suggested_category VARCHAR(255) NOT NULL,
    suggested_subcategory VARCHAR(255),
    existing_category_id INTEGER REFERENCES categories(id),
    existing_subcategory_id INTEGER REFERENCES subcategories(id),
    regex_pattern TEXT,
    confidence VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP
);

-- Migrations tracking table
CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Transaction indexes
CREATE INDEX IF NOT EXISTS idx_transactions_posted_at ON transactions(posted_at);
CREATE INDEX IF NOT EXISTS idx_transactions_posted_category ON transactions(posted_at, category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_uncertain ON transactions(is_uncertain) WHERE is_uncertain = TRUE;
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_description_norm ON transactions(description_norm);
CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(hash);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);

-- Rules indexes
CREATE INDEX IF NOT EXISTS idx_rules_pattern ON rules(pattern);
CREATE INDEX IF NOT EXISTS idx_rules_active ON rules(active, priority DESC);
CREATE INDEX IF NOT EXISTS idx_rules_user ON rules(user_id);

-- Mappings index
CREATE INDEX IF NOT EXISTS idx_mappings_description ON mappings(description_norm);
CREATE INDEX IF NOT EXISTS idx_mappings_user ON mappings(user_id);

-- Transaction links indexes
CREATE INDEX IF NOT EXISTS idx_links_source ON transaction_links(source_transaction_id);
CREATE INDEX IF NOT EXISTS idx_links_target ON transaction_links(target_transaction_id);
CREATE INDEX IF NOT EXISTS idx_links_type ON transaction_links(link_type);

-- AI suggestions indexes
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_status ON ai_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_transaction ON ai_suggestions(transaction_id);

-- User-scoped indexes
CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_statements_user ON statements(user_id);
