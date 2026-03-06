import { test, expect } from '@playwright/test';

/**
 * Landing Page E2E Tests
 * Tests the public landing page that doesn't require authentication
 */

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    // No auth setup needed - this is an unauthenticated route
  });

  test('should load the landing page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check that the page has content
    const body = await page.locator('body').textContent();
    expect(body).toBeTruthy();
  });

  test('should display main heading', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Look for main heading text
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    const text = await heading.textContent();
    expect(text).toContain('Financial');
  });

  test('should show Get Started buttons', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check for at least one Get Started button
    const getStartedBtn = page.getByRole('button', { name: /get started/i }).first();
    await expect(getStartedBtn).toBeVisible();
  });

  test('should show features button in navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check for Features button in nav
    const featuresBtn = page.getByRole('button', { name: /features/i });
    await expect(featuresBtn).toBeVisible();
  });
});
