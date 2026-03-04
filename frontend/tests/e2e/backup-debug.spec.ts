import { test, expect } from '@playwright/test';

test('debug profile loading', async ({ page }) => {
  // Set up localStorage auth BEFORE page loads
  await page.addInitScript(() => {
    (window as any).supabase = {
      auth: {
        getSession: async () => ({ 
          data: { session: { user: { id: 'test-user-123' }, access_token: 'mock-access-token' } }, 
          error: null 
        }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } }, error: null }),
      },
    };
  });

  // Mock API
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    console.log('REQUEST:', url);
    
    if (!url.includes('/api/')) {
      await route.continue();
      return;
    }
    
    if (url.includes('/auth/me')) {
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
    
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  await page.goto('/profile');
  await page.waitForTimeout(3000);
  
  // Print URL and visible text
  console.log('CURRENT URL:', page.url());
  const bodyText = await page.locator('body').textContent();
  console.log('BODY TEXT:', bodyText?.substring(0, 500));
});
