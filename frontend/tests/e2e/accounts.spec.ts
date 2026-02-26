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
    // Mock authentication
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
      };
      localStorage.setItem('auth_token', 'mock-token');
      localStorage.setItem('auth_user', JSON.stringify({ id: 1, username: 'testuser' }));
    });

    // Mock auth/me endpoint
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, username: 'testuser' }),
      });
    });

    // Mock accounts endpoint
    await page.route('**/api/accounts', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, name: 'Test Bank', type: 'bank', balance: 1000, currency: 'USD' },
          { id: 2, name: 'Cash', type: 'cash', balance: 500, currency: 'USD' },
        ]),
      });
    });

    // Mock categories endpoint
    await page.route('**/api/categories**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });
  });

  test.describe('Accounts Page', () => {
    test('should load accounts page', async ({ page }) => {
      await page.goto('/accounts');
      await expect(page.getByText('Accounts')).toBeVisible({ timeout: 10000 });
    });

    test('should display accounts list', async ({ page }) => {
      await page.goto('/accounts');
      await expect(page.getByText('Test Bank')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('Cash')).toBeVisible();
    });

    test('should have add account button', async ({ page }) => {
      await page.goto('/accounts');
      await expect(page.getByText('Accounts')).toBeVisible({ timeout: 10000 });
      
      // Look for Add Account button in the page
      const addButton = page.getByRole('button', { name: /add account/i });
      await expect(addButton.first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Account Types', () => {
    test('should show different account types', async ({ page }) => {
      await page.goto('/accounts');
      await expect(page.getByText('Test Bank')).toBeVisible({ timeout: 10000 });
      
      // Look for account type indicators (icons or text)
      const hasTypeIndicator = await page.locator('[class*="bank"], [class*="cash"], [class*="credit"]').count() > 0;
      expect(hasTypeIndicator).toBeTruthy();
    });

    test('should display account balances', async ({ page }) => {
      await page.goto('/accounts');
      await expect(page.getByText('Test Bank')).toBeVisible({ timeout: 10000 });
      
      // Balances should be displayed (format: $1,000 or similar)
      const hasBalance = await page.locator('[class*="balance"], [class*="amount"]').count() > 0;
      expect(hasBalance).toBeTruthy();
    });
  });

  test.describe('Account Management', () => {
    test('should open add account form', async ({ page }) => {
      await page.goto('/accounts');
      await expect(page.getByText('Accounts')).toBeVisible({ timeout: 10000 });
      
      // Click add account button
      const addButton = page.getByRole('button', { name: /add account/i }).first();
      await addButton.click();
      
      // Should show form fields
      await expect(page.locator('input, select, textarea').first()).toBeVisible();
    });

    test('should have account name field', async ({ page }) => {
      await page.goto('/accounts');
      await expect(page.getByText('Accounts')).toBeVisible({ timeout: 10000 });
      
      // Click add account button to open form
      const addButton = page.getByRole('button', { name: /add account/i }).first();
      await addButton.click();
      
      // Check for name field
      await expect(page.getByLabel(/name/i)).toBeVisible();
    });

    test('should have balance field', async ({ page }) => {
      await page.goto('/accounts');
      await expect(page.getByText('Accounts')).toBeVisible({ timeout: 10000 });
      
      // Click add account button to open form
      const addButton = page.getByRole('button', { name: /add account/i }).first();
      await addButton.click();
      
      // Check for balance field
      await expect(page.getByLabel(/balance/i)).toBeVisible();
    });
  });
});
