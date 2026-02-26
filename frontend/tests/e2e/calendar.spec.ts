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

    // Mock auth/me endpoint
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, username: 'testuser' }),
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

    // Mock calendar API
    await page.route('**/api/calendar/**', async (route) => {
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
    await expect(page.getByText('Calendar')).toBeVisible({ timeout: 10000 });
  });

  test('should display month navigation', async ({ page }) => {
    await expect(page.getByText('Calendar')).toBeVisible({ timeout: 10000 });
    // Navigation arrows should be present
    const hasNav = await page.locator('button:has-text("‹"), button:has-text("›"), [class*="chevron"]').count() > 0;
    expect(hasNav).toBeTruthy();
  });

  test('should display month totals', async ({ page }) => {
    await expect(page.getByText('Calendar')).toBeVisible({ timeout: 10000 });
    // Month total section
    const hasTotals = await page.locator('[class*="total"], [class*="summary"]').count() > 0 
      || await page.getByText(/income|expenses|net/i).count() > 0;
    expect(hasTotals).toBeTruthy();
  });

  test('should display calendar grid', async ({ page }) => {
    await expect(page.getByText('Calendar')).toBeVisible({ timeout: 10000 });
    // Calendar days should be rendered
    await page.waitForTimeout(1000);
    const hasGrid = await page.locator('[class*="calendar"], [class*="day"]').count() > 0;
    expect(hasGrid).toBeTruthy();
  });
});
