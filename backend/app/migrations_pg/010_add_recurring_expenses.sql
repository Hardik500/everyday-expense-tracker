-- Add recurring expenses feature (PostgreSQL)
-- This migration creates tables for tracking recurring bills and subscriptions

-- Table for recurring expense patterns
CREATE TABLE IF NOT EXISTS recurring_expenses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    amount NUMERIC NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    frequency TEXT NOT NULL, -- 'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'
    interval_days INTEGER DEFAULT 30, -- for 'custom' frequency
    category_id INTEGER,
    subcategory_id INTEGER,
    account_id INTEGER,
    start_date TEXT NOT NULL, -- ISO date YYYY-MM-DD
    end_date TEXT, -- Optional end date
    next_due_date TEXT NOT NULL, -- Calculated next occurrence
    previous_due_date TEXT, -- When it was last paid
    is_active INTEGER NOT NULL DEFAULT 1,
    auto_detected INTEGER NOT NULL DEFAULT 0, -- AI detected
    merchant_pattern TEXT, -- For auto-detection
    alert_days_before INTEGER DEFAULT 3, -- How many days before to alert
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY(subcategory_id) REFERENCES subcategories(id) ON DELETE SET NULL,
    FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

-- Table for individual occurrences/payments of recurring expenses
CREATE TABLE IF NOT EXISTS recurring_payments (
    id SERIAL PRIMARY KEY,
    recurring_expense_id INTEGER NOT NULL,
    transaction_id INTEGER, -- Link to actual transaction if paid
    scheduled_date TEXT NOT NULL,
    paid_date TEXT, -- When actually paid
    expected_amount NUMERIC NOT NULL,
    actual_amount NUMERIC, -- May differ from expected
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'overdue', 'skipped', 'failed'
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(recurring_expense_id) REFERENCES recurring_expenses(id) ON DELETE CASCADE,
    FOREIGN KEY(transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_user_active ON recurring_expenses(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_next_due ON recurring_expenses(next_due_date);
CREATE INDEX IF NOT EXISTS idx_recurring_payments_expense ON recurring_payments(recurring_expense_id);
CREATE INDEX IF NOT EXISTS idx_recurring_payments_scheduled ON recurring_payments(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_recurring_payments_status ON recurring_payments(status);
