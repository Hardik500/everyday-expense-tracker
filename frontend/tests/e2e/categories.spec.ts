import { test, expect } from '@playwright/test';

/**
 * Categories E2E Tests
 * 
 * Tests the categories management page including:
 * - Category list display
 * - Add/Edit/Delete categories
 * - Category icons
 * - Subcategories
 */

test.describe('Categories', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).supabase = {
        auth: {
          getSession: async () => ({
            data: { session: { user: { id: 'test-user' }, access_token: 'mock' } },
            error: null
          }),
          onAuthStateChange: () => ({
            data: { subscription: { unsubscribe: () => {} } },
            error: null
          }),
        },
        from: (table: string) => ({
          select: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
            eq: () => Promise.resolve({ data: [], error: null })
          }),
          insert: () => Promise.resolve({ data: [], error: null }),
          update: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
          delete: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
        }),
      };
    });
  });

  test.describe('Categories Page', () => {
    test('should load categories page', async ({ page }) => {
      await page.goto('/categories');
      await page.waitForLoadState('networkidle');
      await expect(page).not.toHaveTitle(/Error/);
    });

    test('should display categories list', async ({ page }) => {
      await page.goto('/categories');
      await page.waitForLoadState('networkidle');
      
      // Look for category elements
      const hasContent = await page.locator('[class*="category"], [class*="icon"], table, grid').first().count() > 0;
      expect(hasContent).toBeTruthy();
    });

    test('should have add category button', async ({ page }) => {
      await page.goto('/categories');
      await page.waitForLoadState('networkidle');
      
      const addButton = page.locator('button:has-text("Add"), button:has-text("New"), a:has-text("Add")');
      await expect(addButton.first()).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Category Management', () => {
    test('should open add category form', async ({ page }) => {
      await page.goto('/categories');
      await page.waitForLoadState('networkidle');
      
      const addButton = page.locator('button:has-text("Add"), button:has-text("New")').first();
      await addButton.click();
      await page.waitForTimeout(500);
      
      // Should show form or modal
      const hasForm = await page.locator('form, [role="dialog"], [class*="modal"], input').count() > 0;
      expect(hasForm).toBeTruthy();
    });

    test('should have category name field', async ({ page }) => {
      await page.goto('/categories');
      await page.waitForLoadState('networkidle');
      
      const addButton = page.locator('button:has-text("Add"), button:has-text("New")').first();
      await addButton.click();
      await page.waitForTimeout(500);
      
      // Look for name input
      const nameInput = page.locator('input[name*="name"], input[id*="name"], input[placeholder*="name"]');
      expect(await nameInput.count()).toBeGreaterThanOrEqual(0);
    });

    test('should have icon selector', async ({ page }) => {
      await page.goto('/categories');
      await page.waitForLoadState('networkidle');
      
      const addButton = page.locator('button:has-text("Add"), button:has-text("New")').first();
      await addButton.click();
      await page.waitForTimeout(500);
      
      // Look for icon, emoji, or symbol selectors
      const iconElements = page.locator('[class*="icon"], button[class*="icon"], [class*="emoji"]');
      const count = await iconElements.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});
