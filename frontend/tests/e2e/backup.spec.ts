import { test, expect } from '@playwright/test';

test.describe('Backup/Restore UI', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
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
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, username: 'testuser', gmail_enabled: false }),
      });
    });

    // Navigate to profile page
    await page.goto('/profile');
  });

  test('should display backup section with export button', async ({ page }) => {
    // Look for the backup section
    await expect(page.getByText('Data Backup')).toBeVisible();
    await expect(page.getByText('Export your data as JSON')).toBeVisible();
    
    // Check for export button
    const exportButton = page.getByRole('button', { name: /export backup/i });
    await expect(exportButton).toBeVisible();
  });

  test('should display import section with file input', async ({ page }) => {
    // Look for the import section
    await expect(page.getByText('Restore Data')).toBeVisible();
    await expect(page.getByText('Import from a backup file')).toBeVisible();
    
    // Check for file input (it's a label styled as button)
    const importButton = page.getByRole('button', { name: /choose file/i });
    await expect(importButton).toBeVisible();
  });

  test('should show exporting state when export clicked', async ({ page }) => {
    // Mock the export endpoint to not actually download
    await page.route('**/api/backup/export', async (route) => {
      route.abort('failed');
    });
    
    const exportButton = page.getByRole('button', { name: /export backup/i });
    await exportButton.click();
    
    // Should show exporting state
    await expect(page.getByText(/exporting/i)).toBeVisible();
  });
});
