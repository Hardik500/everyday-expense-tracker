import { test, expect } from '@playwright/test';

test.describe('Recurring Expenses UI', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication - store in localStorage
    await page.addInitScript(() => {
      (window as any).supabase = {
        auth: {
          getSession: async () => ({ 
            data: { session: { user: { id: 'test-user' }, access_token: 'mock-token' } }, 
            error: null 
          }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } }, error: null }),
        },
      };
      localStorage.setItem('auth_token', 'mock-token');
      localStorage.setItem('auth_user', JSON.stringify({ id: 1, username: 'testuser' }));
    });
    // MSW handles the API calls - no need for page.route()
  });

  test('should display recurring expenses page', async ({ page }) => {
    await page.goto('/recurring');
    await expect(page.getByText('Recurring Expenses')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Track your recurring bills')).toBeVisible();
  });

  test('should display list of expenses', async ({ page }) => {
    await page.goto('/recurring');
    await expect(page.getByText('Netflix')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Internet Bill')).toBeVisible();
    await expect(page.getByText('₹199')).toBeVisible();
  });

  test('should display stats cards', async ({ page }) => {
    await page.goto('/recurring');
    await expect(page.getByText('Active Recurring')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('2')).toBeVisible(); // Count
    await expect(page.getByText('Monthly Total')).toBeVisible();
  });

  test('should show add modal when clicking add button', async ({ page }) => {
    await page.goto('/recurring');
    await page.getByRole('button', { name: /add recurring/i }).click();
    await expect(page.getByRole('heading', { name: 'Add Recurring Expense' })).toBeVisible();
  });
});
