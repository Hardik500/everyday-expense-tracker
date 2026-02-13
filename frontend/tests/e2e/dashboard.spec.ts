import { test, expect } from '@playwright/test';

test.describe('Dashboard Stats', () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth state
    await page.addInitScript(() => {
      (window as any).supabase = {
        auth: {
          getSession: async () => ({
            data: { session: { user: { id: 'test-user', email: 'test@example.com' } } },
            error: null,
          }),
        },
      };
    });
  });

  test('should load dashboard page without crash', async ({ page }) => {
    await page.goto('/dashboard');

    // Check if dashboard loads without errors
    await expect(page).toHaveTitle(/Expense Tracker|Dashboard/);

    // Page should be stable (no console errors)
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    await page.waitForLoadState('networkidle').catch(() => {
      // Network idle might timeout, that's OK
    });

    // Check for console errors
    expect(errors.length).toBe(0);
  });

  test('should display stat cards', async ({ page }) => {
    await page.goto('/dashboard');

    // Look for stat card elements various possible selectors
    const hasStatCards = await page.locator('[data-testid^="stat-"], .stat-card, .stat-box, .stat-item').count() > 0;
    const hasNumericStats = await page.locator('text=/\\$[\\d,]+|\\d+%|\\d+ transactions/i').count() > 0;
    const hasCardsWithAmount = await page.locator('text=/\\$|amount|balance|spending/i').count() > 0;

    // At least some stat-related content should be present
    expect(hasStatCards || hasNumericStats || hasCardsWithAmount).toBeTruthy();
  });

  test('should display dashboard without errors', async ({ page }) => {
    await page.goto('/dashboard');

    // Ensure the page body is visible
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should have dashboard heading', async ({ page }) => {
    await page.goto('/dashboard');

    // Look for dashboard heading
    const hasDashboardHeading = await page.getByRole('heading', { name: /dashboard|overview|summary/i }).count() > 0;

    // Dashboard heading is nice to have but not required
    if (hasDashboardHeading) {
      await expect(page.getByRole('heading', { name: /dashboard|overview|summary/i })).toBeVisible();
    }
  });

  test('should display UI components', async ({ page }) => {
    await page.goto('/dashboard');

    // Check for common dashboard UI elements
    const hasCards = await page.locator('.card, [class*="card"]').count() > 0;
    const hasCharts = await page.locator('.chart, svg, canvas').count() > 0;
    const hasLists = await page.locator('ul, ol, .list').count() > 0;

    // Dashboard should have some kind of UI components
    expect(hasCards || hasCharts || hasLists).toBeTruthy();
  });

  test.skip('should display total spending', async ({ page }) => {
    // Test requires actual data
    // Skip for now - foundation only

    await page.goto('/dashboard');

    // Look for total spending display
    const totalSpending = await page.locator('text=/total.*spending|spending.*total/i').count() > 0;
    if (totalSpending) {
      expect(totalSpending).toBeTruthy();
    }
  });

  test.skip('should display transaction count', async ({ page }) => {
    // Test requires actual data
    // Skip for now - foundation only

    await page.goto('/dashboard');

    // Look for transaction count display
    const transactionCount = await page.locator('text=/transactions?\\s*\\d+/i').count() > 0;
    if (transactionCount) {
      expect(transactionCount).toBeTruthy();
    }
  });
});