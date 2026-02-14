import { test, expect } from '@playwright/test';

test.describe('Cash Flow Calendar', () => {
  test.beforeEach(async ({ page }) => {
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

    await page.route('**/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, username: 'testuser' }),
      });
    });

    // Mock calendar API
    await page.route('**/api/v1/calendar/**', async (route) => {
      const url = route.url();
      const match = url.match(/calendar\/(\d+)\/(\d+)/);
      const year = match ? match[1] : '2026';
      const month = match ? match[2] : '2';
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          year: parseInt(year),
          month: parseInt(month),
          month_total: { income: 50000, expenses: 35000, net: 15000 },
          days: [
            { date: '2026-02-01', income: 0, expenses: 500, net: -500, transaction_count: 2, transactions: [] },
            { date: '2026-02-02', income: 25000, expenses: 0, net: 25000, transaction_count: 1, transactions: [] },
            { date: '2026-02-14', income: 0, expenses: 2000, net: -2000, transaction_count: 3, transactions: [] },
          ],
        }),
      });
    });

    await page.goto('/calendar');
  });

  test('should display calendar page', async ({ page }) => {
    await expect(page.getByText('Cash Flow Calendar')).toBeVisible();
    await expect(page.getByText('Monthly view of your spending')).toBeVisible();
  });

  test('should display month navigation', async ({ page }) => {
    await expect(page.getByRole('button', { name: /previous/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /next/i })).toBeVisible();
  });

  test('should display month totals', async ({ page }) => {
    await expect(page.getByText('Income')).toBeVisible();
    await expect(page.getByText('Expenses')).toBeVisible();
    await expect(page.getByText('Net')).toBeVisible();
  });

  test('should display calendar grid', async ({ page }) => {
    // Should show day numbers
    await expect(page.locator('.calendar-day').first()).toBeVisible();
  });
});
