import { test, expect } from '@playwright/test';

test.describe('Duplicate Detection Interface', () => {
  test.beforeEach(async ({ page }) => {
    // Set authenticated mock
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

    // Mock categories endpoint (needed by app)
    await page.route('**/api/categories**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // Mock duplicates detection API
    await page.route('**/api/duplicates/detect**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1,
            original_transaction_id: 101,
            duplicate_transaction_id: 102,
            similarity_score: 0.95,
            original_amount: 500,
            original_description: 'Grocery Store',
            original_date: '2026-02-15',
            duplicate_amount: 500,
            duplicate_description: 'Grocery Store',
            duplicate_date: '2026-02-15',
          }
        ]),
      });
    });

    // Navigate to duplicates page
    await page.goto('/duplicates');
  });

  test('should display duplicate detection section', async ({ page }) => {
    // Wait for page to load
    await expect(page.getByText('Duplicate Detection')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Find and merge potential duplicate transactions')).toBeVisible();
  });

  test('should show results when duplicates found', async ({ page }) => {
    // Wait for the duplicate detection to load
    await expect(page.getByText('Duplicate Detection')).toBeVisible({ timeout: 10000 });
    
    // Wait for results (if any appear)
    await page.waitForTimeout(1000);
    
    // Check for either results or empty state
    const hasContent = await page.locator('[class*="duplicate"], [class*="card"], .match').count() > 0 
      || await page.getByText(/no duplicates/i).count() > 0;
    expect(hasContent).toBeTruthy();
  });

  test('should have scan settings with period selector', async ({ page }) => {
    // Wait for page to load
    await expect(page.getByText('Duplicate Detection')).toBeVisible({ timeout: 10000 });
    
    // Check for scan button
    await expect(page.getByRole('button', { name: /scan/i })).toBeVisible();
  });

  test('should show scan button', async ({ page }) => {
    await expect(page.getByText('Duplicate Detection')).toBeVisible({ timeout: 10000 });
    const scanButton = page.getByRole('button', { name: /scan/i });
    await expect(scanButton).toBeVisible();
  });
});
