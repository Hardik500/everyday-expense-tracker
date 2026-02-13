-- Add soft-delete support to transactions table for trash functionality

-- Add deleted_at column to track when a transaction was moved to trash
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL DEFAULT NULL;

-- Add is_deleted boolean column as a convenience
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

-- Create index for efficient querying of trash items
CREATE INDEX IF NOT EXISTS idx_transactions_deleted ON transactions(is_deleted, deleted_at);

-- Add comment
COMMENT ON COLUMN transactions.deleted_at IS 'Timestamp when transaction was moved to trash (NULL if not deleted)';
COMMENT ON COLUMN transactions.is_deleted IS 'Whether the transaction is in trash (soft-deleted)';