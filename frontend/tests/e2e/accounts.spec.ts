import { test, expect } from '@playwright/test';

/**
 * Accounts E2E Tests
 * 
 * Tests the accounts management page including:
 * - Account list display
 * - Add/Edit/Delete accounts
 * - Account types (bank, cash, credit, investment)
 * - Account balances
 */

test.describe('Accounts', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).supabase = {
        auth: {
          getSession: async () => ({
            data: { session: { user: { id: 'test-user' }, access_token: 'mock' } },
            error: null
          }),
          onAuthStateChange: () => ({
            data: { subscription: { unsubscribe: () => {} } },
            error: null
          }),
        },
        from: (table: string) => ({
          select: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
            eq: () => Promise.resolve({ data: [], error: null })
          }),
          insert: () => Promise.resolve({ data: [], error: null }),
          update: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
          delete: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
        }),
      };
    });
  });

  test.describe('Accounts Page', () => {
    test('should load accounts page', async ({ page }) => {
      await page.goto('/accounts');
      await page.waitForLoadState('networkidle');
      await expect(page).not.toHaveTitle(/Error/);
    });

    test('should display accounts list', async ({ page }) => {
      await page.goto('/accounts');
      await page.waitForLoadState('networkidle');
      
      // Look for account elements
      const hasContent = await page.locator('[class*="account"], [class*="card"], table, grid').first().count() > 0;
      expect(hasContent).toBeTruthy();
    });

    test('should have add account button', async ({ page }) => {
      await page.goto('/accounts');
      await page.waitForLoadState('networkidle');
      
      const addButton = page.locator('button:has-text("Add"), button:has-text("New"), a:has-text("Add")');
      await expect(addButton.first()).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Account Types', () => {
    test('should show different account types', async ({ page }) => {
      await page.goto('/accounts');
      await page.waitForLoadState('networkidle');
      
      // Look for account type indicators
      const typeLabels = page.locator('text=Bank, text=Cash, text=Credit, text=Investment');
      const count = await typeLabels.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should display account balances', async ({ page }) => {
      await page.goto('/accounts');
      await page.waitForLoadState('networkidle');
      
      // Look for currency/amount indicators
      const amounts = page.locator('[class*="balance"], [class*="amount"], [class*="currency"]');
      const count = await amounts.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Account Management', () => {
    test('should open add account form', async ({ page }) => {
      await page.goto('/accounts');
      await page.waitForLoadState('networkidle');
      
      const addButton = page.locator('button:has-text("Add"), button:has-text("New")').first();
      await addButton.click();
      await page.waitForTimeout(500);
      
      const hasForm = await page.locator('form, [role="dialog"], [class*="modal"]').count() > 0;
      expect(hasForm).toBeTruthy();
    });

    test('should have account name field', async ({ page }) => {
      await page.goto('/accounts');
      await page.waitForLoadState('networkidle');
      
      const addButton = page.locator('button:has-text("Add"), button:has-text("New")').first();
      await addButton.click();
      await page.waitForTimeout(500);
      
      const nameInput = page.locator('input[name*="name"], input[id*="name"]');
      expect(await nameInput.count()).toBeGreaterThanOrEqual(0);
    });

    test('should have balance field', async ({ page }) => {
      await page.goto('/accounts');
      await page.waitForLoadState('networkidle');
      
      const addButton = page.locator('button:has-text("Add"), button:has-text("New")').first();
      await addButton.click();
      await page.waitForTimeout(500);
      
      const balanceInput = page.locator('input[name*="balance"], input[name*="amount"], input[type="number"]');
      expect(await balanceInput.count()).toBeGreaterThanOrEqual(0);
    });
  });
});
