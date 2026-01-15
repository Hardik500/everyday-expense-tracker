-- Indexes for faster transaction queries

-- Index on posted_at for date range queries (most important)
CREATE INDEX IF NOT EXISTS idx_transactions_posted_at ON transactions(posted_at);

-- Composite index for date + category queries
CREATE INDEX IF NOT EXISTS idx_transactions_posted_category ON transactions(posted_at, category_id);

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);

-- Index for uncertain transactions (review queue)
CREATE INDEX IF NOT EXISTS idx_transactions_uncertain ON transactions(is_uncertain) WHERE is_uncertain = 1;

-- Index for account filtering
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);

-- Index for description search (pattern matching)
CREATE INDEX IF NOT EXISTS idx_transactions_description_norm ON transactions(description_norm);

-- Index for hash lookups (deduplication)
CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(hash);

-- Index for rules pattern matching
CREATE INDEX IF NOT EXISTS idx_rules_pattern ON rules(pattern);
CREATE INDEX IF NOT EXISTS idx_rules_active ON rules(active, priority DESC);

-- Index for mappings lookup
CREATE INDEX IF NOT EXISTS idx_mappings_description ON mappings(description_norm);

-- Index for transaction links
CREATE INDEX IF NOT EXISTS idx_links_source ON transaction_links(source_transaction_id);
CREATE INDEX IF NOT EXISTS idx_links_target ON transaction_links(target_transaction_id);
CREATE INDEX IF NOT EXISTS idx_links_type ON transaction_links(link_type);
