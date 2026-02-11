-- Add parser tracking columns to statements table
-- Tracks which parser was used and success metrics

-- SQLite doesn't support ALTER TABLE ADD COLUMN with constraints in older versions
-- So we use separate statements

ALTER TABLE statements ADD COLUMN parser TEXT DEFAULT 'legacy';
ALTER TABLE statements ADD COLUMN parser_version TEXT;
ALTER TABLE statements ADD COLUMN transactions_found INTEGER DEFAULT 0;
ALTER TABLE statements ADD COLUMN transactions_inserted INTEGER DEFAULT 0;
ALTER TABLE statements ADD COLUMN parser_error TEXT;
