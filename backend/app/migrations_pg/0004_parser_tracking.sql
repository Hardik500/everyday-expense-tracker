-- PostgreSQL migration: Add parser tracking columns to statements table
-- Tracks which parser was used and success metrics

-- Add parser tracking columns
ALTER TABLE statements 
    ADD COLUMN parser VARCHAR(50) DEFAULT 'legacy',
    ADD COLUMN parser_version VARCHAR(50),
    ADD COLUMN transactions_found INTEGER DEFAULT 0,
    ADD COLUMN transactions_inserted INTEGER DEFAULT 0,
    ADD COLUMN parser_error TEXT;

-- Add index for querying by parser
CREATE INDEX idx_statements_parser ON statements(parser);

-- Add index for querying by parser version
CREATE INDEX idx_statements_parser_version ON statements(parser_version);
