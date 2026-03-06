import { test, expect } from '@playwright/test';

test.describe('Backup/Restore UI', () => {
  test.beforeEach(async ({ page }) => {
    // CRITICAL: Start MSW first, then set up mocks
    await page.addInitScript(() => {
      // Mock supabase at window level - this is what AuthContext calls
      (window as any).supabase = {
        auth: {
          getSession: async () => ({ 
            data: { session: { user: { id: 'test-user-123' }, access_token: 'mock-access-token' } }, 
            error: null 
          }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } }, error: null }),
        },
      };
      
      // Set localStorage auth data BEFORE page loads
      localStorage.setItem('auth_token', 'mock-access-token');
      localStorage.setItem('auth_user', JSON.stringify({ 
        id: 1, 
        username: 'testuser', 
        email: 'test@example.com',
        onboarding_completed: true
      }));
      
      // Also set the supabase token format
      localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'mock-access-token',
        user: { id: 'test-user-123', email: 'test@example.com' }
      }));
    });

    // Intercept ALL requests - including supabase
    await page.route('**/*', async (route) => {
      const url = route.request().url();
      const method = route.request().method();
      
      // Handle Supabase auth requests
      if (url.includes('supabase') || url.includes('auth/v1')) {
        if (url.includes('session')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              access_token: 'mock-access-token',
              user: { id: 'test-user-123', email: 'test@example.com' }
            }),
          });
          return;
        }
      }
      
      // Handle API requests
      if (url.includes('/api/')) {
        // Auth/me - critical for authenticated routes
        if (url.includes('/api/auth/me') || url.includes('/auth/me')) {
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
        
        // Categories
        if (url.includes('/api/categories')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([]),
          });
          return;
        }
        
        // Accounts
        if (url.includes('/api/accounts')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([]),
          });
          return;
        }
        
        // Goals
        if (url.includes('/api/goals')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([]),
          });
          return;
        }
        
        // Review count
        if (url.includes('/api/review') && url.includes('count')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([]),
          });
          return;
        }
        
        // Backup export
        if (url.includes('/api/backup/export') || url.includes('/backup/export')) {
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
        
        // Backup import
        if (url.includes('/api/backup/import') || url.includes('/backup/import')) {
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
        
        // Profile
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
        
        // Default: return success
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
        return;
      }
      
      // Let all other requests through (static assets, etc.)
      await route.continue();
    });
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
    await expect(page.getByText('Export Backup')).toBeVisible();
    await expect(page.getByText('Restore Data')).toBeVisible();
  });
});
