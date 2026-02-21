import { test, expect } from '@playwright/test';

test.describe('Recurring Expenses UI', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
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

    // Mock auth/me endpoint
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, username: 'testuser' }),
      });
    });

    // Mock recurring expenses API
    await page.route('**/api/recurring-expenses**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 1,
              name: 'Netflix',
              amount: 199,
              currency: 'INR',
              frequency: 'monthly',
              next_due_date: '2026-02-25',
              is_active: true,
              auto_detected: false,
              alert_days_before: 3,
            },
            {
              id: 2,
              name: 'Internet Bill',
              amount: 999,
              currency: 'INR',
              frequency: 'monthly',
              next_due_date: '2026-03-01',
              is_active: true,
              auto_detected: true,
              alert_days_before: 3,
            }
          ]),
        });
      } else {
        await route.continue();
      }
    });

    // Mock stats
    await page.route('**/api/recurring-expenses/stats/summary', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total_active: 2,
          upcoming_count: 1,
          overdue_count: 0,
          monthly_total: 1198,
          by_frequency: { monthly: { count: 2, total: 1198 } },
          by_category: []
        }),
      });
    });

    // Mock references
    await page.route('**/categories', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ categories: [], subcategories: [] }),
      });
    });
    await page.route('**/accounts', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // Navigate to recurring page
    await page.goto('/recurring');
  });

  test('should display recurring expenses page', async ({ page }) => {
    await expect(page.getByText('Recurring Expenses')).toBeVisible();
    await expect(page.getByText('Track your recurring bills')).toBeVisible();
  });

  test('should display list of expenses', async ({ page }) => {
    await expect(page.getByText('Netflix')).toBeVisible();
    await expect(page.getByText('Internet Bill')).toBeVisible();
    await expect(page.getByText('₹199')).toBeVisible();
  });

  test('should display stats cards', async ({ page }) => {
    await expect(page.getByText('Active Recurring')).toBeVisible();
    await expect(page.getByText('2')).toBeVisible(); // Count
    await expect(page.getByText('Monthly Total')).toBeVisible();
  });

  test('should show add modal when clicking add button', async ({ page }) => {
    await page.getByRole('button', { name: /add recurring/i }).click();
    await expect(page.getByRole('heading', { name: 'Add Recurring Expense' })).toBeVisible();
  });
});
