import { test, expect } from '@playwright/test';

test.describe('Backup/Restore UI', () => {
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

  test('should display backup section with export button', async ({ page }) => {
    await page.goto('/profile');
    await expect(page.getByText('Data Backup')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Export your data as JSON')).toBeVisible();
    const exportButton = page.getByRole('button', { name: /export backup/i });
    await expect(exportButton).toBeVisible();
  });

  test('should display import section with file input', async ({ page }) => {
    await page.goto('/profile');
    await expect(page.getByText('Data Backup')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Restore Data')).toBeVisible();
    await expect(page.getByText('Import from a backup file')).toBeVisible();
  });

  test('should display both export and import sections', async ({ page }) => {
    await page.goto('/profile');
    await expect(page.getByText('Data Backup')).toBeVisible({ timeout: 15000 });
    // Check both sections are present
    await expect(page.getByText('Export Backup')).toBeVisible();
    await expect(page.getByText('Restore Data')).toBeVisible();
  });
});
