-- Add notes column to transactions table
-- This column exists in the SQLite schema but was missing from PostgreSQL migration

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS notes TEXT;