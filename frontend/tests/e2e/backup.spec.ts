import { test, expect } from '@playwright/test';

test.describe('Backup/Restore UI', () => {
  test.beforeEach(async ({ page }) => {
    // Mock supabase auth
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

    // Mock the API - intercept requests to localhost:8000
    await page.route('http://localhost:8000/**', async (route) => {
      const url = route.url();
      
      if (url.includes('/auth/me')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: 1, username: 'testuser', gmail_enabled: false }),
        });
        return;
      }
      if (url.includes('/auth/google/url')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ url: 'https://accounts.google.com/oauth/authorize' }),
        });
        return;
      }
      if (url.includes('/user/gmail/config')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ enabled: false, email: null }),
        });
        return;
      }
      if (url.includes('/user/profile')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ theme: 'dark', currency: 'USD' }),
        });
        return;
      }
      
      // Default
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    });

    // Navigate to profile page
    await page.goto('/profile');
  });

  test('should display backup section with export button', async ({ page }) => {
    await expect(page.getByText('Data Backup')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Export your data as JSON')).toBeVisible();
    const exportButton = page.getByRole('button', { name: /export backup/i });
    await expect(exportButton).toBeVisible();
  });

  test('should display import section with file input', async ({ page }) => {
    await expect(page.getByText('Data Backup')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Restore Data')).toBeVisible();
    await expect(page.getByText('Import from a backup file')).toBeVisible();
  });

  test('should display both export and import sections', async ({ page }) => {
    await expect(page.getByText('Data Backup')).toBeVisible({ timeout: 20000 });
    // Check both sections are present
    await expect(page.getByText('Export Backup')).toBeVisible();
    await expect(page.getByText('Restore Data')).toBeVisible();
  });
});
