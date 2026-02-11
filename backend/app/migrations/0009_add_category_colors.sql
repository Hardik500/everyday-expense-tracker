-- Add color column to categories table
ALTER TABLE categories ADD COLUMN color TEXT DEFAULT NULL;

-- Update existing categories with default colors
UPDATE categories SET color = '#EF4444' WHERE name = 'Bills';
UPDATE categories SET color = '#F59E0B' WHERE name = 'Dining';
UPDATE categories SET color = '#10B981' WHERE name = 'Entertainment';
UPDATE categories SET color = '#3B82F6' WHERE name = 'Groceries';
UPDATE categories SET color = '#8B5CF6' WHERE name = 'Health';
UPDATE categories SET color = '#EC4899' WHERE name = 'Shopping';
UPDATE categories SET color = '#06B6D4' WHERE name = 'Transport';
UPDATE categories SET color = '#84CC16' WHERE name = 'Travel';
UPDATE categories SET color = '#64748B' WHERE name = 'Income';
UPDATE categories SET color = '#94A3B8' WHERE name = 'Uncategorized';
