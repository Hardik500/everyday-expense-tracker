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

    // Mock duplicates detection API
    await page.route('**/api/v1/duplicates/detect**', async (route) => {
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
    // Look for duplicate detection UI
    await expect(page.getByText('Duplicate Detection')).toBeVisible();
    await expect(page.getByText('Find and manage potential duplicate transactions')).toBeVisible();
  });

  test('should show results when duplicates found', async ({ page }) => {
    // Wait for the duplicate card to appear
    await expect(page.locator('.duplicate-card')).toBeVisible();
    await expect(page.getByText('Grocery Store')).toHaveCount(2); // One for original, one for duplicate
    await expect(page.getByText('95% Match')).toBeVisible();
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
