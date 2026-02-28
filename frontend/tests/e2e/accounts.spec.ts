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
    // Mock auth - store in localStorage (for app initialization)
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'mock-token');
      localStorage.setItem('auth_user', JSON.stringify({ id: 1, username: 'testuser' }));
    });
    // MSW handles the API calls - no need for page.route()
  });

  test.describe('Accounts Page', () => {
    test('should load accounts page', async ({ page }) => {
      await page.goto('/accounts');
      await expect(page.getByText('Accounts')).toBeVisible({ timeout: 15000 });
    });

    test('should display accounts list', async ({ page }) => {
      await page.goto('/accounts');
      await expect(page.getByText('Test Bank')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('Cash')).toBeVisible({ timeout: 15000 });
    });

    test('should have add account button', async ({ page }) => {
      await page.goto('/accounts');
      await expect(page.getByRole('button', { name: /add account/i })).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('Account Types', () => {
    test('should show different account types', async ({ page }) => {
      await page.goto('/accounts');
      await expect(page.getByText('bank')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('cash')).toBeVisible({ timeout: 15000 });
    });

    test('should display account balances', async ({ page }) => {
      await page.goto('/accounts');
      await page.waitForTimeout(1000);
      const pageContent = await page.content();
      expect(pageContent).toContain('1,000');
    });
  });

  test.describe('Account Management', () => {
    test('should open add account form', async ({ page }) => {
      await page.goto('/accounts');
      await page.getByRole('button', { name: /add account/i }).click();
      await expect(page.getByLabel(/account name/i)).toBeVisible({ timeout: 5000 });
    });

    test('should have account name field', async ({ page }) => {
      await page.goto('/accounts');
      await page.getByRole('button', { name: /add account/i }).click();
      await expect(page.getByLabel(/name/i)).toBeVisible({ timeout: 5000 });
    });

    test('should have balance field', async ({ page }) => {
      await page.goto('/accounts');
      await page.getByRole('button', { name: /add account/i }).click();
      await expect(page.getByLabel(/balance/i)).toBeVisible({ timeout: 5000 });
    });
  });
});
