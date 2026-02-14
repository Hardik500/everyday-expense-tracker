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
      
      // Also mock localStorage to skip syncWithBackend if possible or just mock the fetch
      localStorage.setItem('auth_token', 'mock-token');
      localStorage.setItem('auth_user', JSON.stringify({ id: 1, username: 'testuser' }));
    });

    // Mock the /auth/me call
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, username: 'testuser' }),
      });
    });

    // Navigate to duplicates page
    await page.goto('/duplicates');
  });

  test('should display duplicate detection section', async ({ page }) => {
    // Look for duplicate detection UI
    await expect(page.getByText('Duplicate Detection')).toBeVisible();
    await expect(page.getByText('Find and manage potential duplicate transactions')).toBeVisible();
  });

  test('should have scan settings with period selector', async ({ page }) => {
    // Check for scan settings
    await expect(page.getByText('Scan Period')).toBeVisible();
    await expect(page.getByRole('button', { name: /scan now/i })).toBeVisible();
  });

  test('should show scan button', async ({ page }) => {
    const scanButton = page.getByRole('button', { name: /scan now/i });
    await expect(scanButton).toBeVisible();
  });
});
