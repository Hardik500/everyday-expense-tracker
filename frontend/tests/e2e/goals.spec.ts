import { test, expect } from '@playwright/test';

test.describe('Goals Dashboard', () => {
  test.beforeEach(async ({ page }) => {
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

    await page.route('**/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, username: 'testuser' }),
      });
    });

    // Mock goals API
    await page.route('**/api/v1/goals', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1,
            name: 'Emergency Fund',
            description: 'Build 6 months of expenses',
            target_amount: 100000,
            current_amount: 45000,
            progress_percent: 45,
            days_remaining: 180,
            deadline: '2026-08-14',
            icon: '🏦',
            color: '#22c55e',
            is_active: true,
          },
          {
            id: 2,
            name: 'New Laptop',
            description: 'MacBook Pro M4',
            target_amount: 150000,
            current_amount: 120000,
            progress_percent: 80,
            days_remaining: 30,
            deadline: '2026-03-14',
            icon: '💻',
            color: '#3b82f6',
            is_active: true,
          },
        ]),
      });
    });

    await page.goto('/goals');
  });

  test('should display goals page', async ({ page }) => {
    await expect(page.getByText('Goals Dashboard')).toBeVisible();
    await expect(page.getByText('Track your savings progress')).toBeVisible();
  });

  test('should display goals with progress', async ({ page }) => {
    await expect(page.getByText('Emergency Fund')).toBeVisible();
    await expect(page.getByText('New Laptop')).toBeVisible();
  });

  test('should show progress bars', async ({ page }) => {
    const progressBars = page.locator('.progress-bar-fill');
    await expect(progressBars).toHaveCount(2);
  });

  test('should show add goal button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /add goal/i })).toBeVisible();
  });
});
