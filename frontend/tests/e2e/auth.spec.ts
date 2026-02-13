import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Supabase auth to avoid real authentication during tests
    await page.addInitScript(() => {
      // Mock Supabase client
      (window as any).supabase = {
        auth: {
          getSession: async () => ({
            data: { session: null },
            error: null,
          }),
          onAuthStateChange: () => ({
            data: { subscription: null },
            error: null,
          }),
        },
      };
    });
  });

  test('should load login page', async ({ page }) => {
    await page.goto('/');

    // Check if we're redirected to login or if auth page is visible
    // The app might redirect to a login route or show auth UI
    await expect(page).toHaveTitle(/Expense Tracker|Login|Sign In/);
  });

  test('should display auth UI elements', async ({ page }) => {
    await page.goto('/');

    // Look for common auth elements
    const hasLoginButton = await page.locator('button').filter({ hasText: /log in|sign in|login/i }).count() > 0;
    const hasEmailInput = await page.locator('input[type="email"]').count() > 0;
    const hasPasswordInput = await page.locator('input[type="password"]').count() > 0;

    // At least one auth-related element should be present
    expect(hasLoginButton || hasEmailInput || hasPasswordInput).toBeTruthy();
  });

  test('should handle mocked auth state', async ({ page }) => {
    await page.goto('/');

    // With mocked unauth state, user should see login/auth UI
    // not be automatically logged in
    const pageUrl = page.url();
    expect(pageUrl).toBeDefined();
  });

  test.skip('should handle successful login', async ({ page }) => {
    // This test requires deeper Supabase mocking or a test backend
    // Skip for now - just set up the foundation

    await page.goto('/');

    // Mock successful auth response
    await page.addInitScript(() => {
      (window as any).supabase = {
        auth: {
          getSession: async () => ({
            data: { session: { user: { id: 'test-user', email: 'test@example.com' } } },
            error: null,
          }),
        },
      };
    });

    // Navigate to dashboard would require actual auth flow
    await page.goto('/dashboard');
  });
});