import { http, HttpResponse } from 'msw';

export const handlers = [
  // Auth - both with and without /api prefix
  http.get('/auth/me', () => {
    return HttpResponse.json({ id: 1, username: 'testuser', email: 'test@example.com' });
  }),
  http.get('/api/auth/me', () => {
    return HttpResponse.json({ id: 1, username: 'testuser', email: 'test@example.com' });
  }),

  // Accounts - without /api prefix (what the frontend actually calls)
  http.get('/accounts', () => {
    return HttpResponse.json([
      { id: 1, name: 'Test Bank', type: 'bank', balance: 1000, currency: 'USD' },
      { id: 2, name: 'Cash', type: 'cash', balance: 500, currency: 'USD' },
    ]);
  }),

  http.post('/accounts', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: 3, ...body }, { status: 201 });
  }),

  http.put('/accounts/:id', async ({ params, request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: params.id, ...body });
  }),

  http.delete('/accounts/:id', () => {
    return HttpResponse.json({ success: true });
  }),

  // Categories - without /api prefix
  http.get('/categories', () => {
    return HttpResponse.json([
      { id: 1, name: 'Food', icon: 'utensils', color: '#FF6B6B' },
      { id: 2, name: 'Transport', icon: 'car', color: '#4ECDC4' },
    ]);
  }),

  http.post('/categories', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: 3, ...body }, { status: 201 });
  }),

  http.put('/categories/:id', async ({ params, request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: params.id, ...body });
  }),

  http.delete('/categories/:id', () => {
    return HttpResponse.json({ success: true });
  }),

  // Transactions - without /api prefix
  http.get('/transactions', ({ request }) => {
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

  http.post('/transactions', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: 3, ...body }, { status: 201 });
  }),

  http.put('/transactions/:id', async ({ params, request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: params.id, ...body });
  }),

  http.delete('/transactions/:id', () => {
    return HttpResponse.json({ success: true });
  }),

  // Dashboard stats - without /api prefix
  http.get('/dashboard/stats', () => {
    return HttpResponse.json({
      totalBalance: 1500,
      monthlyIncome: 3000,
      monthlyExpenses: 1200,
      transactionCount: 45,
    });
  }),

  http.get('/dashboard/recent', () => {
    return HttpResponse.json([
      { id: 1, amount: 50, description: 'Groceries', date: '2026-02-20', category: { name: 'Food' } },
      { id: 2, amount: 30, description: 'Bus fare', date: '2026-02-19', category: { name: 'Transport' } },
    ]);
  }),

  // Goals - using /api/v1 prefix
  http.get('/api/v1/goals', () => {
    return HttpResponse.json([
      { id: 1, name: 'Emergency Fund', target_amount: 5000, current_amount: 2500, deadline: '2026-12-31', category_id: null },
      { id: 2, name: 'Vacation', target_amount: 2000, current_amount: 500, deadline: '2026-06-30', category_id: null },
    ]);
  }),

  http.post('/api/v1/goals', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: 3, ...body }, { status: 201 });
  }),

  http.put('/api/v1/goals/:id', async ({ params, request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: params.id, ...body });
  }),

  http.post('/api/v1/goals/:id/contribute', async ({ params, request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: params.id, current_amount: body.amount, success: true });
  }),

  http.delete('/api/v1/goals/:id', () => {
    return HttpResponse.json({ success: true });
  }),

  // Duplicates - using /api/v1 prefix
  http.get('/api/v1/duplicates', () => {
    return HttpResponse.json({
      duplicates: [],
      total: 0,
    });
  }),

  http.post('/api/v1/duplicates/detect', () => {
    return HttpResponse.json({ scanned: 0, found: 0 });
  }),

  http.post('/api/v1/duplicates/action', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ merged: body.ids?.length || 0 });
  }),

  // Calendar - without /api prefix
  http.get('/calendar/month', ({ request }) => {
    const url = new URL(request.url);
    const year = url.searchParams.get('year') || '2026';
    const month = url.searchParams.get('month') || '2';
    
    const days = [];
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        date: year + '-' + month.padStart(2, '0') + '-' + d.toString()., '0'),
padStart(2        income: Math.random() > 0.7 ? Math.floor(Math.random() * 2000) : 0,
        expenses: Math.random() > 0.3 ? Math.floor(Math.random() * 500) : 0,
      });
    }
    
    return HttpResponse.json(days);
  }),

  // Backup - without /api prefix
  http.get('/backup/export', () => {
    return HttpResponse.json({
      accounts: [],
      categories: [],
      transactions: [],
      goals: [],
      exported_at: new Date().toISOString(),
    });
  }),

  http.post('/backup/import', () => {
    return HttpResponse.json({ imported: 0, errors: [] });
  }),

  // Recurring Expenses - without /api prefix
  http.get('/recurring-expenses', () => {
    return HttpResponse.json([
      { id: 1, name: 'Netflix', amount: 199, currency: 'INR', frequency: 'monthly', category_id: 1, next_due_date: '2026-03-01', is_active: true, auto_detected: false, alert_days_before: 3, start_date: '2026-01-01', category_name: 'Entertainment' },
      { id: 2, name: 'Internet Bill', amount: 999, currency: 'INR', frequency: 'monthly', category_id: 2, next_due_date: '2026-03-05', is_active: true, auto_detected: false, alert_days_before: 3, start_date: '2026-01-01', category_name: 'Utilities' },
      { id: 3, name: 'Spotify', amount: 399, currency: 'INR', frequency: 'monthly', category_id: 1, next_due_date: '2026-03-10', is_active: false, auto_detected: true, alert_days_before: 3, start_date: '2026-01-01', category_name: 'Entertainment' },
    ]);
  }),

  http.get('/recurring-expenses/stats/summary', () => {
    return HttpResponse.json({
      total_active: 2,
      upcoming_count: 1,
      overdue_count: 0,
      monthly_total: 1198,
      by_frequency: { monthly: { count: 2, total: 1198 } },
      by_category: []
    });
  }),

  http.post('/recurring-expenses', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: 4, ...body }, { status: 201 });
  }),

  http.patch('/recurring-expenses/:id', async ({ params, request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: params.id, ...body });
  }),

  http.delete('/recurring-expenses/:id', () => {
    return HttpResponse.json({ success: true });
  }),

  // Analytics - without /api prefix
  http.get('/analytics/insights', ({ request }) => {
    return HttpResponse.json([
      { category: 'Food', amount: 500, percentage: 35 },
      { category: 'Transport', amount: 200, percentage: 14 },
      { category: 'Entertainment', amount: 150, percentage: 10 },
    ]);
  }),

  http.get('/analytics/monthly-trend', ({ request }) => {
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

  // Review (for duplicate detection) - without /api prefix
  http.get('/review/count', () => {
    return HttpResponse.json({ count: 0 });
  }),

  // Cards - without /api prefix
  http.get('/cards', () => {
    return HttpResponse.json([
      { id: 1, name: 'Visa', last_four: '1234', balance: 500, limit: 5000, card_type: 'credit' },
    ]);
  }),

  http.post('/cards', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: 2, ...body }, { status: 201 });
  }),

  http.put('/cards/:id', async ({ params, request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: params.id, ...body });
  }),

  http.delete('/cards/:id', () => {
    return HttpResponse.json({ success: true });
  }),

  // AI endpoints
  http.get('/ai/suggestions', () => {
    return HttpResponse.json({ suggestions: [] });
  }),

  http.post('/ai/suggestions/:id/approve', () => {
    return HttpResponse.json({ success: true });
  }),

  http.post('/ai/suggestions/:id/reject', () => {
    return HttpResponse.json({ success: true });
  }),

  http.post('/ai/categorize', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ category_id: 1, confidence: 0.95 });
  }),
];
