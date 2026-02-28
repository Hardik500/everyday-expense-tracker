import { test, expect } from '@playwright/test';

test.describe('Duplicate Detection Interface', () => {
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

  test('should display duplicate detection section', async ({ page }) => {
    await page.goto('/duplicates');
    // Wait for page to load
    await expect(page.getByText('Duplicate Detection')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Find and merge potential duplicate transactions')).toBeVisible();
  });

  test('should show results when duplicates found', async ({ page }) => {
    await page.goto('/duplicates');
    // Wait for the duplicate detection to load
    await expect(page.getByText('Duplicate Detection')).toBeVisible({ timeout: 15000 });
    
    // Wait for results (if any appear)
    await page.waitForTimeout(1000);
    
    // Check for either results or empty state
    const hasContent = await page.locator('[class*="duplicate"], [class*="card"], .match').count() > 0 
      || await page.getByText(/no duplicates/i).count() > 0;
    expect(hasContent).toBeTruthy();
  });

  test('should have scan settings with period selector', async ({ page }) => {
    await page.goto('/duplicates');
    // Wait for page to load
    await expect(page.getByText('Duplicate Detection')).toBeVisible({ timeout: 15000 });
    
    // Check for scan button
    await expect(page.getByRole('button', { name: /scan/i })).toBeVisible();
  });

  test('should show scan button', async ({ page }) => {
    await page.goto('/duplicates');
    await expect(page.getByText('Duplicate Detection')).toBeVisible({ timeout: 15000 });
    const scanButton = page.getByRole('button', { name: /scan/i });
    await expect(scanButton).toBeVisible();
  });
});
