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
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, username: 'testuser', gmail_enabled: false }),
      });
    });

    // Mock Google auth URL endpoint
    await page.route('**/api/auth/google/url', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: 'https://accounts.google.com/oauth/authorize' }),
      });
    });

    // Mock Gmail config endpoint
    await page.route('**/api/user/gmail/config', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enabled: false, email: null }),
      });
    });

    // Mock user profile endpoint
    await page.route('**/api/user/profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ theme: 'dark', currency: 'USD' }),
      });
    });

    // Navigate to profile page
    await page.goto('/profile');
  });

  test('should display backup section with export button', async ({ page }) => {
    // Wait for the page to load and Data Backup section to be visible
    await expect(page.getByText('Data Backup')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Export your data as JSON')).toBeVisible();
    
    // Check for export button
    const exportButton = page.getByRole('button', { name: /export backup/i });
    await expect(exportButton).toBeVisible();
  });

  test('should display import section with file input', async ({ page }) => {
    // Wait for the page to load
    await expect(page.getByText('Data Backup')).toBeVisible({ timeout: 10000 });
    
    // Look for the import section
    await expect(page.getByText('Restore Data')).toBeVisible();
    await expect(page.getByText('Import from a backup file')).toBeVisible();
    
    // Check for file input (it's a label styled as button)
    const importButton = page.getByRole('button', { name: /choose file/i });
    await expect(importButton).toBeVisible();
  });

  test('should show exporting state when export clicked', async ({ page }) => {
    // Mock the export endpoint to return success
    await page.route('**/api/backup/export', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          transactions: [], 
          accounts: [], 
          categories: [],
          rules: [],
          goals: []
        }),
      });
    });
    
    const exportButton = page.getByRole('button', { name: /export backup/i });
    await exportButton.click();
    
    // Button should show "Exporting..." while loading
    await expect(page.getByRole('button', { name: /exporting/i })).toBeVisible();
  });
});
