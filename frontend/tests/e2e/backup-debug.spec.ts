import { test, expect } from '@playwright/test';

test('debug profile loading', async ({ page }) => {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  page.on('requestfailed', request => {
    console.log('REQUEST FAILED:', request.url(), request.failure()?.errorText);
  });
  
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

  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    console.log('API REQUEST:', url);
    
    if (url.includes('/api/auth/me')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          id: 1, 
          username: 'testuser', 
          email: 'test@example.com',
          currency: 'INR',
          locale: 'en-IN'
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
  
  console.log('CONSOLE ERRORS:', JSON.stringify(errors));
  console.log('Page URL:', page.url());
});
