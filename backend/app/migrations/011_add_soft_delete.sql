-- Add soft-delete support to transactions table for trash functionality

-- Add deleted_at column to track when a transaction was moved to trash
ALTER TABLE transactions ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL;

-- Add is_deleted boolean column as a convenience
ALTER TABLE transactions ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT 0;

-- Create index for efficient querying of trash items
CREATE INDEX IF NOT EXISTS idx_transactions_deleted ON transactions(is_deleted, deleted_at);