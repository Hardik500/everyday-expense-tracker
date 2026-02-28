import { test, expect } from '@playwright/test';

test.describe('Cash Flow Calendar', () => {
  test.beforeEach(async ({ page }) => {
    // Mock supabase auth - store in localStorage
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

  test('should display calendar page', async ({ page }) => {
    await page.goto('/calendar');
    await expect(page.getByText('Calendar')).toBeVisible({ timeout: 15000 });
  });

  test('should display month navigation', async ({ page }) => {
    await page.goto('/calendar');
    await expect(page.getByText('Calendar')).toBeVisible({ timeout: 15000 });
    // Navigation arrows should be present
    const hasNav = await page.locator('button:has-text("‹"), button:has-text("›"), [class*="chevron"]').count() > 0;
    expect(hasNav).toBeTruthy();
  });

  test('should display month totals', async ({ page }) => {
    await page.goto('/calendar');
    await expect(page.getByText('Calendar')).toBeVisible({ timeout: 15000 });
    // Month total section
    const hasTotals = await page.locator('[class*="total"], [class*="summary"]').count() > 0 
      || await page.getByText(/income|expenses|net/i).count() > 0;
    expect(hasTotals).toBeTruthy();
  });

  test('should display calendar grid', async ({ page }) => {
    await page.goto('/calendar');
    await expect(page.getByText('Calendar')).toBeVisible({ timeout: 15000 });
    // Calendar days should be rendered
    await page.waitForTimeout(1000);
    const hasGrid = await page.locator('[class*="calendar"], [class*="day"]').count() > 0;
    expect(hasGrid).toBeTruthy();
  });
});
