-- PostgreSQL migration: Add parser tracking columns to statements table
-- Tracks which parser was used and success metrics
-- Uses DO block to safely add columns if they don't exist

DO $$
BEGIN
    -- Add parser column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'statements' AND column_name = 'parser') THEN
        ALTER TABLE statements ADD COLUMN parser VARCHAR(50) DEFAULT 'legacy';
    END IF;

    -- Add parser_version column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'statements' AND column_name = 'parser_version') THEN
        ALTER TABLE statements ADD COLUMN parser_version VARCHAR(50);
    END IF;

    -- Add transactions_found column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'statements' AND column_name = 'transactions_found') THEN
        ALTER TABLE statements ADD COLUMN transactions_found INTEGER DEFAULT 0;
    END IF;

    -- Add transactions_inserted column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'statements' AND column_name = 'transactions_inserted') THEN
        ALTER TABLE statements ADD COLUMN transactions_inserted INTEGER DEFAULT 0;
    END IF;

    -- Add parser_error column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'statements' AND column_name = 'parser_error') THEN
        ALTER TABLE statements ADD COLUMN parser_error TEXT;
    END IF;
END $$;

-- Add indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_statements_parser ON statements(parser);
CREATE INDEX IF NOT EXISTS idx_statements_parser_version ON statements(parser_version);
