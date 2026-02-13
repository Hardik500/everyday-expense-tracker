-- Create trash table for soft-delete functionality

CREATE TABLE IF NOT EXISTS trash (
    id SERIAL PRIMARY KEY,
    original_table VARCHAR(50) NOT NULL,
    original_id INTEGER NOT NULL,
    data JSONB NOT NULL,
    deleted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_by INTEGER NOT NULL REFERENCES users(id),
    reason TEXT
);

-- Index for efficient querying of trash items by user
CREATE INDEX IF NOT EXISTS idx_trash_user ON trash(deleted_by, deleted_at DESC);

-- Index for efficient querying by original table
CREATE INDEX IF NOT EXISTS idx_trash_original ON trash(original_table, original_id);

-- Add comments
COMMENT ON TABLE trash IS 'Trash bin for soft-deleted items (transactions, categories, accounts, rules)';
COMMENT ON COLUMN trash.original_table IS 'Name of the table the item came from (transactions, categories, accounts, rules)';
COMMENT ON COLUMN trash.original_id IS 'ID of the item in the original table';
COMMENT ON COLUMN trash.data IS 'Complete snapshot of the deleted item as JSON';
COMMENT ON COLUMN trash.deleted_by IS 'User who deleted the item';

-- Ensure only valid table names can be stored
ALTER TABLE trash ADD CONSTRAINT check_original_table
    CHECK (original_table IN ('transactions', 'categories', 'accounts', 'rules'));