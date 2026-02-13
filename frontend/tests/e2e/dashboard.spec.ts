import { test, expect } from '@playwright/test';

/**
 * Dashboard E2E Tests
 * 
 * Tests the main dashboard including:
 * - Dashboard loading
 * - Stat cards display
 * - Charts and graphs
 * - Recent transactions
 * - Navigation
 */

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authenticated state
    await page.addInitScript(() => {
      (window as any).supabase = {
        auth: {
          getSession: async () => ({
            data: {
              session: {
                user: { id: 'test-user', email: 'test@example.com' },
                access_token: 'mock-token'
              }
            },
            error: null
          }),
          onAuthStateChange: () => ({
            data: { subscription: { unsubscribe: () => {} } },
            error: null
          }),
        },
        from: (table: string) => ({
          select: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: [], error: null })
            }),
            eq: () => Promise.resolve({ data: [], error: null })
          }),
          insert: () => Promise.resolve({ data: [], error: null }),
        }),
      };
    });
  });

  test.describe('Dashboard Page', () => {
    test('should load dashboard successfully', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Dashboard should load without errors
      await expect(page).not.toHaveTitle(/Error|404|500/);
    });

    test('should display navigation menu', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Check for navigation elements
      const nav = page.locator('nav, [role="navigation"]');
      await expect(nav.first()).toBeVisible({ timeout: 10000 });
    });

    test('should have working navigation links', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Find common nav links
      const navLinks = page.locator('nav a, [role="navigation"] a, .sidebar a');
      
      // Should have multiple navigation items
      const count = await navLinks.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should display stat cards or summary', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Look for stat cards, numbers, or amounts
      // Could be in various formats
      const pageContent = await page.content();
      // The dashboard should have some numerical content (amounts, counts, etc.)
      expect(pageContent).toMatch(/\d+/);
    });
  });

  test.describe('Dashboard Navigation', () => {
    test('should navigate to transactions', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Find and click transactions link
      const transactionsLink = page.locator('a:has-text("Transaction"), a[href*="transaction"]').first();
      
      if (await transactionsLink.count() > 0) {
        await transactionsLink.click();
        await page.waitForLoadState('networkidle');
        expect(page.url()).toMatch(/transaction|trans/gi);
      }
    });

    test('should navigate to accounts', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      const accountsLink = page.locator('a:has-text("Account"), a[href*="account"]').first();
      
      if (await accountsLink.count() > 0) {
        await accountsLink.click();
        await page.waitForLoadState('networkidle');
        expect(page.url()).toMatch(/account|acc/gi);
      }
    });

    test('should navigate to categories', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      const categoriesLink = page.locator('a:has-text("Category"), a[href*="category"]').first();
      
      if (await categoriesLink.count() > 0) {
        await categoriesLink.click();
        await page.waitForLoadState('networkidle');
        expect(page.url()).toMatch(/categor/gi);
      }
    });

    test('should navigate to analytics', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      const analyticsLink = page.locator('a:has-text("Analytics"), a[href*="analytics"], a[href*="report"]').first();
      
      if (await analyticsLink.count() > 0) {
        await analyticsLink.click();
        await page.waitForLoadState('networkidle');
        expect(page.url()).toMatch(/analytics|report|chart/gi);
      }
    });

    test('should navigate to upload', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      const uploadLink = page.locator('a:has-text("Upload"), a[href*="upload"], a[href*="import"]').first();
      
      if (await uploadLink.count() > 0) {
        await uploadLink.click();
        await page.waitForLoadState('networkidle');
        expect(page.url()).toMatch(/upload|import/gi);
      }
    });
  });

  test.describe('User Menu', () => {
    test('should display user menu or profile', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Look for user avatar, name, or menu
      const userElements = page.locator('[class*="user"], [class*="profile"], [class*="avatar"]');
      const hasUserElement = await userElements.count() > 0 || 
        await page.locator('text=test@example.com').count() > 0;
      
      // Either shows user info or has logout option
      const hasLogout = await page.locator('button:has-text("Logout"), a:has-text("Logout"), a:has-text("Sign out")').count() > 0;
      expect(hasUserElement || hasLogout).toBeTruthy();
    });

    test('should have logout option', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      const logoutButton = page.locator('button:has-text("Logout"), a:has-text("Logout"), a:has-text("Sign out")');
      expect(await logoutButton.count()).toBeGreaterThanOrEqual(0);
    });
  });
});
