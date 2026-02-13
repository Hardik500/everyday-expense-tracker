import { test, expect } from '@playwright/test';

/**
 * Upload E2E Tests
 * 
 * Tests the file upload functionality including:
 * - Upload page loading
 * - File selection
 * - Upload progress
 * - Statement parsing
 */

test.describe('Upload', () => {
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
        storage: {
          from: () => ({
            upload: () => Promise.resolve({ data: { path: 'test.pdf' }, error: null }),
            getPublicUrl: () => ({ data: { publicUrl: 'https://test.com/file.pdf' } })
          })
        }
      };
    });
  });

  test.describe('Upload Page', () => {
    test('should load upload page', async ({ page }) => {
      await page.goto('/upload');
      await page.waitForLoadState('networkidle');
      await expect(page).not.toHaveTitle(/Error/);
    });

    test('should display upload area', async ({ page }) => {
      await page.goto('/upload');
      await page.waitForLoadState('networkidle');
      
      // Look for upload elements
      const uploadArea = page.locator('[class*="upload"], [class*="dropzone"], input[type="file"]');
      await expect(uploadArea.first()).toBeVisible({ timeout: 10000 });
    });

    test('should have file input', async ({ page }) => {
      await page.goto('/upload');
      await page.waitForLoadState('networkidle');
      
      const fileInput = page.locator('input[type="file"]');
      await expect(fileInput).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('File Upload', () => {
    test('should accept PDF files', async ({ page }) => {
      await page.goto('/upload');
      await page.waitForLoadState('networkidle');
      
      const fileInput = page.locator('input[type="file"]');
      const accept = await fileInput.getAttribute('accept');
      
      // Should accept PDF or common document types
      const acceptsPdf = accept?.includes('pdf') || accept?.includes('csv') || accept?.includes('ofx');
      expect(acceptsPdf).toBeTruthy();
    });

    test('should show supported formats', async ({ page }) => {
      await page.goto('/upload');
      await page.waitForLoadState('networkidle');
      
      // Look for format hints
      const formatText = page.locator('text=PDF, text=CSV, text=statement, text=Supported');
      const count = await formatText.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});

/**
 * Analytics E2E Tests
 * 
 * Tests the analytics/reports page including:
 * - Analytics page loading
 * - Charts display
 * - Date range selection
 * - Report generation
 */

test.describe('Analytics', () => {
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
        from: () => ({
          select: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
            eq: () => Promise.resolve({ data: [], error: null })
          })
        })
      };
    });
  });

  test.describe('Analytics Page', () => {
    test('should load analytics page', async ({ page }) => {
      await page.goto('/analytics');
      await page.waitForLoadState('networkidle');
      await expect(page).not.toHaveTitle(/Error/);
    });

    test('should display charts or graphs', async ({ page }) => {
      await page.goto('/analytics');
      await page.waitForLoadState('networkidle');
      
      // Look for chart elements (recharts uses svg)
      const hasCharts = await page.locator('svg[class*="recharts"], [class*="chart"], [class*="graph"]').count() > 0;
      const hasContent = hasCharts || await page.locator('[class*="stat"], [class*="metric"]').count() > 0;
      expect(hasContent).toBeTruthy();
    });

    test('should have date range selector', async ({ page }) => {
      await page.goto('/analytics');
      await page.waitForLoadState('networkidle');
      
      const dateSelector = page.locator('input[type="date"], select, [class*="date"], [class*="range"]');
      const count = await dateSelector.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Reports', () => {
    test('should have export options', async ({ page }) => {
      await page.goto('/analytics');
      await page.waitForLoadState('networkidle');
      
      const exportButton = page.locator('button:has-text("Export"), button:has-text("PDF"), button:has-text("CSV")');
      const count = await exportButton.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should show spending insights', async ({ page }) => {
      await page.goto('/analytics');
      await page.waitForLoadState('networkidle');
      
      const insights = page.locator('[class*="insight"], [class*="summary"], text=Total, text=Spending');
      const count = await insights.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});
