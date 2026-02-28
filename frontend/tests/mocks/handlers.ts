import { http, HttpResponse } from 'msw';

export const handlers = [
  // Auth
  http.get('/api/auth/me', () => {
    return HttpResponse.json({ id: 1, username: 'testuser', email: 'test@example.com' });
  }),

  // Accounts
  http.get('/api/accounts', () => {
    return HttpResponse.json([
      { id: 1, name: 'Test Bank', type: 'bank', balance: 1000, currency: 'USD' },
      { id: 2, name: 'Cash', type: 'cash', balance: 500, currency: 'USD' },
    ]);
  }),

  http.post('/api/accounts', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: 3, ...body }, { status: 201 });
  }),

  http.put('/api/accounts/:id', async ({ params, request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: params.id, ...body });
  }),

  http.delete('/api/accounts/:id', () => {
    return HttpResponse.json({ success: true });
  }),

  // Categories
  http.get('/api/categories', () => {
    return HttpResponse.json([
      { id: 1, name: 'Food', icon: 'utensils', color: '#FF6B6B' },
      { id: 2, name: 'Transport', icon: 'car', color: '#4ECDC4' },
    ]);
  }),

  http.post('/api/categories', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: 3, ...body }, { status: 201 });
  }),

  http.put('/api/categories/:id', async ({ params, request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: params.id, ...body });
  }),

  http.delete('/api/categories/:id', () => {
    return HttpResponse.json({ success: true });
  }),

  // Transactions
  http.get('/api/transactions', ({ request }) => {
    const url = new URL(request.url);
    const page = url.searchParams.get('page') || '1';
    const limit = url.searchParams.get('limit') || '50';
    
    return HttpResponse.json({
      data: [
        { id: 1, amount: 50, description: 'Groceries', category_id: 1, date: '2026-02-20', type: 'expense' },
        { id: 2, amount: 30, description: 'Bus fare', category_id: 2, date: '2026-02-19', type: 'expense' },
      ],
      page: parseInt(page),
      limit: parseInt(limit),
      total: 2,
    });
  }),

  http.post('/api/transactions', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: 3, ...body }, { status: 201 });
  }),

  http.put('/api/transactions/:id', async ({ params, request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: params.id, ...body });
  }),

  http.delete('/api/transactions/:id', () => {
    return HttpResponse.json({ success: true });
  }),

  // Dashboard stats
  http.get('/api/dashboard/stats', () => {
    return HttpResponse.json({
      totalBalance: 1500,
      monthlyIncome: 3000,
      monthlyExpenses: 1200,
      transactionCount: 45,
    });
  }),

  http.get('/api/dashboard/recent', () => {
    return HttpResponse.json([
      { id: 1, amount: 50, description: 'Groceries', date: '2026-02-20', category: { name: 'Food' } },
      { id: 2, amount: 30, description: 'Bus fare', date: '2026-02-19', category: { name: 'Transport' } },
    ]);
  }),

  // Goals
  http.get('/api/goals', () => {
    return HttpResponse.json([
      { id: 1, name: 'Emergency Fund', target_amount: 5000, current_amount: 2500, deadline: '2026-12-31', category_id: null },
      { id: 2, name: 'Vacation', target_amount: 2000, current_amount: 500, deadline: '2026-06-30', category_id: null },
    ]);
  }),

  http.post('/api/goals', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: 3, ...body }, { status: 201 });
  }),

  http.put('/api/goals/:id', async ({ params, request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: params.id, ...body });
  }),

  http.post('/api/goals/:id/contribute', async ({ params, request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: params.id, current_amount: body.amount, success: true });
  }),

  http.delete('/api/goals/:id', () => {
    return HttpResponse.json({ success: true });
  }),

  // Duplicates
  http.get('/api/duplicates', () => {
    return HttpResponse.json({
      duplicates: [],
      total: 0,
    });
  }),

  http.post('/api/duplicates/scan', () => {
    return HttpResponse.json({ scanned: 0, found: 0 });
  }),

  http.post('/api/duplicates/merge', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ merged: body.ids?.length || 0 });
  }),

  // Calendar
  http.get('/api/calendar/month', ({ request }) => {
    const url = new URL(request.url);
    const year = url.searchParams.get('year') || '2026';
    const month = url.searchParams.get('month') || '2';
    
    // Generate daily data for the month
    const days = [];
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        date: `${year}-${month.padStart(2, '0')}-${d.toString().padStart(2, '0')}`,
        income: Math.random() > 0.7 ? Math.floor(Math.random() * 2000) : 0,
        expenses: Math.random() > 0.3 ? Math.floor(Math.random() * 500) : 0,
      });
    }
    
    return HttpResponse.json(days);
  }),

  // Backup
  http.get('/api/backup/export', () => {
    return HttpResponse.json({
      accounts: [],
      categories: [],
      transactions: [],
      goals: [],
      exported_at: new Date().toISOString(),
    });
  }),

  http.post('/api/backup/import', () => {
    return HttpResponse.json({ imported: 0, errors: [] });
  }),

  // Recurring
  http.get('/api/recurring', () => {
    return HttpResponse.json([
      { id: 1, name: 'Netflix', amount: 15, frequency: 'monthly', category_id: 1, next_date: '2026-03-01' },
    ]);
  }),

  http.post('/api/recurring', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: 2, ...body }, { status: 201 });
  }),

  http.put('/api/recurring/:id', async ({ params, request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: params.id, ...body });
  }),

  http.delete('/api/recurring/:id', () => {
    return HttpResponse.json({ success: true });
  }),

  // Analytics
  http.get('/api/analytics/spending-by-category', ({ request }) => {
    const url = new URL(request.url);
    const period = url.searchParams.get('period') || 'month';
    
    return HttpResponse.json([
      { category: 'Food', amount: 500, percentage: 35 },
      { category: 'Transport', amount: 200, percentage: 14 },
      { category: 'Entertainment', amount: 150, percentage: 10 },
    ]);
  }),

  http.get('/api/analytics/monthly-trend', ({ request }) => {
    const url = new URL(request.url);
    const months = parseInt(url.searchParams.get('months') || '6');
    
    const trend = [];
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      trend.push({
        month: date.toISOString().slice(0, 7),
        income: Math.floor(Math.random() * 3000) + 2000,
        expenses: Math.floor(Math.random() * 1500) + 800,
      });
    }
    
    return HttpResponse.json(trend);
  }),

  // Review (for duplicate detection)
  http.get('/api/review/count', () => {
    return HttpResponse.json({ count: 0 });
  }),
];
