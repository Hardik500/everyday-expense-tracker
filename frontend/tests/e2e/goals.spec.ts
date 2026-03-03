import { test, expect } from '@playwright/test';

test.describe('Goals Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/goals');
    await page.waitForLoadState('domcontentloaded');
  });

  test('should handle goals route navigation', async ({ page }) => {
    // Check that navigation to /goals works (redirects handled by app)
    const url = page.url();
    // Should either be /goals or redirected to / for unauthenticated
    expect(url === 'http://localhost:5173/goals' || url === 'http://localhost:5173/').toBe(true);
  });

  test('should not show console errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    
    await page.goto('/goals');
    await page.waitForLoadState('networkidle');
    
    // No critical console errors expected
    const criticalErrors = consoleErrors.filter(e => 
      !e.includes('favicon') && !e.includes('chunk')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
