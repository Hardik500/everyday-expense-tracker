-- Add notes column to transactions table
ALTER TABLE transactions ADD COLUMN notes TEXT;

-- Create index for faster search
CREATE INDEX IF NOT EXISTS idx_transactions_notes ON transactions(notes) WHERE notes IS NOT NULL;
