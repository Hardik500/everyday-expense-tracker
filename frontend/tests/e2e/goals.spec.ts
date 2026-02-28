import { test, expect } from '@playwright/test';

test.describe('Goals Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Mock supabase auth - store in localStorage
    await page.addInitScript(() => {
      (window as any).supabase = {
        auth: {
          getSession: async () => ({ 
            data: { session: { user: { id: 'test-user' }, access_token: 'mock-token' } }, 
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
    // MSW handles the API calls - no need for page.route()
  });

  test('should display goals page', async ({ page }) => {
    await page.goto('/goals');
    await expect(page.getByText('Goals')).toBeVisible({ timeout: 15000 });
  });

  test('should display goals with progress', async ({ page }) => {
    await page.goto('/goals');
    await expect(page.getByText('Emergency Fund')).toBeVisible({ timeout: 15000 });
  });

  test('should show progress bars', async ({ page }) => {
    await page.goto('/goals');
    await expect(page.getByText('Emergency Fund')).toBeVisible({ timeout: 15000 });
    // Check for progress indicators
    const hasProgress = await page.locator('[class*="progress"], [role="progressbar"]').count() > 0;
    expect(hasProgress).toBeTruthy();
  });

  test('should show add goal button', async ({ page }) => {
    await page.goto('/goals');
    await expect(page.getByText('Goals')).toBeVisible({ timeout: 15000 });
    const addButton = page.getByRole('button', { name: /add.*goal|new.*goal/i });
    await expect(addButton.first()).toBeVisible();
  });
});
