/* 
PHASE-5: Database Index Optimization Migration
Creates indexes for frequently queried columns to improve performance.
SQLite version.
*/

-- Indexes for transactions table (most frequently queried)
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_posted ON transactions(user_id, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_subcategory ON transactions(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON transactions(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_description_norm ON transactions(description_norm);
CREATE INDEX IF NOT EXISTS idx_transactions_user_uncertain ON transactions(user_id, is_uncertain) WHERE is_uncertain = 1;
CREATE INDEX IF NOT EXISTS idx_transactions_user_account ON transactions(user_id, account_id);

-- Indexes for accounts
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user_type ON accounts(user_id, type);

-- Indexes for categories
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_name ON categories(user_id, LOWER(name));

-- Indexes for subcategories  
CREATE INDEX IF NOT EXISTS idx_subcategories_user_id ON subcategories(user_id);
CREATE INDEX IF NOT EXISTS idx_subcategories_category ON subcategories(category_id);

-- Indexes for rules
CREATE INDEX IF NOT EXISTS idx_rules_user_id ON rules(user_id);
CREATE INDEX IF NOT EXISTS idx_rules_user_active ON rules(user_id, active);

-- Indexes for AI suggestions
CREATE INDEX IF NOT EXISTS idx_suggestions_user_status ON ai_suggestions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_suggestions_transaction ON ai_suggestions(transaction_id);

-- Indexes for transaction links
CREATE INDEX IF NOT EXISTS idx_transaction_links_source ON transaction_links(source_transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_links_target ON transaction_links(target_transaction_id);

-- Indexes for statements
CREATE INDEX IF NOT EXISTS idx_statements_account ON statements(account_id);
CREATE INDEX IF NOT EXISTS idx_statements_user ON statements(user_id);

-- Index for mappings
CREATE INDEX IF NOT EXISTS idx_mappings_user ON mappings(user_id);
CREATE INDEX IF NOT EXISTS idx_mappings_desc_user ON mappings(description_norm, user_id);

-- Run ANALYZE to update index statistics
ANALYZE;
