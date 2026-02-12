-- Add missing columns to categories table for production PostgreSQL
-- These columns exist in SQLite but were missing from initial PostgreSQL migration

-- Add color column for category color coding
ALTER TABLE categories ADD COLUMN IF NOT EXISTS color VARCHAR(7);

-- Add monthly_budget column for budget tracking
ALTER TABLE categories ADD COLUMN IF NOT EXISTS monthly_budget DECIMAL(15, 2);

-- Add icon column for category icons
ALTER TABLE categories ADD COLUMN IF NOT EXISTS icon VARCHAR(50);

-- Update comments
COMMENT ON COLUMN categories.color IS 'Hex color code for category (e.g., #FF5733)';
COMMENT ON COLUMN categories.monthly_budget IS 'Monthly budget limit for this category';
COMMENT ON COLUMN categories.icon IS 'Lucide icon name for category (e.g., shopping-cart)';
