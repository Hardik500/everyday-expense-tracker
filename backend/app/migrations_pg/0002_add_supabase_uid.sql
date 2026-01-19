-- Migration: Add supabase_uid to users table
-- This allows linking local user records to Supabase Auth identities.

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS supabase_uid UUID UNIQUE,
ALTER COLUMN hashed_password DROP NOT NULL;

-- Index for fast lookup during JWT validation
CREATE INDEX IF NOT EXISTS idx_users_supabase_uid ON users(supabase_uid);
