import { test, expect } from '@playwright/test';

test.describe('Backup/Restore UI', () => {
  test.beforeEach(async ({ page }) => {
    // Set up localStorage auth BEFORE page loads - this is critical
    await page.addInitScript(() => {
      // Mock Supabase auth
      (window as any).supabase = {
        auth: {
          getSession: async () => ({ 
            data: { session: { user: { id: 'test-user-123' }, access_token: 'mock-access-token' } }, 
            error: null 
          }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } }, error: null }),
        },
      };
      
      // Set localStorage auth data - frontend checks this
      localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'mock-access-token',
        user: { id: 'test-user-123', email: 'test@example.com' }
      }));
      localStorage.setItem('auth_token', 'mock-access-token');
      localStorage.setItem('auth_user', JSON.stringify({ 
        id: 1, 
        username: 'testuser', 
        email: 'test@example.com',
        onboarding_completed: true
      }));
    });

    // Mock ALL fetch requests before page loads
    await page.route('**/*', async (route) => {
      const url = route.request().url();
      
      // Only intercept API calls
      if (!url.includes('/api/')) {
        await route.continue();
        return;
      }
      
      // Mock auth/me endpoint - CRITICAL for profile to load
      if (url.includes('/api/auth/me')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ 
            id: 1, 
            username: 'testuser', 
            email: 'test@example.com',
            currency: 'INR',
            locale: 'en-IN',
            onboarding_completed: true
          }),
        });
        return;
      }
      
      // Mock user/profile endpoint
      if (url.includes('/api/user/profile')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ 
            id: 1, 
            username: 'testuser', 
            email: 'test@example.com',
            currency: 'INR',
            locale: 'en-IN',
            theme: 'light'
          }),
        });
        return;
      }
      
      // Mock backup endpoints
      if (url.includes('/api/backup/export')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            transactions: [],
            accounts: [],
            categories: [],
            goals: []
          }),
        });
        return;
      }
      
      if (url.includes('/api/backup/import')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',  
          body: JSON.stringify({
            imported: { transactions: 0, accounts: 0 },
            errors: []
          }),
        });
        return;
      }
      
      // Default: return empty success response
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });
  });

  test('should display backup section with export button', async ({ page }) => {
    await page.goto('/profile');
    // Wait for the page to load (backup section appears after profile loads)
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
