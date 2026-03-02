import { http, HttpResponse } from 'msw';
import { setupWorker } from 'msw/browser';

const API_BASE = 'http://localhost:8000';

export const worker = setupWorker(
  // Auth
  http.get(`${API_BASE}/api/auth/me`, () => {
    return HttpResponse.json({ id: 1, username: 'testuser', email: 'test@example.com' });
  }),

  // Accounts
  http.get(`${API_BASE}/api/accounts`, () => {
    return HttpResponse.json([
      { id: 1, name: 'Test Bank', type: 'bank', balance: 1000, currency: 'USD' },
      { id: 2, name: 'Cash', type: 'cash', balance: 500, currency: 'USD' },
    ]);
  }),

  http.post(`${API_BASE}/api/accounts`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: 3, ...body }, { status: 201 });
  }),

  http.put(`${API_BASE}/api/accounts/:id`, async ({ params, request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: params.id, ...body });
  }),

  http.delete(`${API_BASE}/api/accounts/:id`, () => {
    return HttpResponse.json({ success: true });
  }),

  // Categories
  http.get(`${API_BASE}/api/categories`, () => {
    return HttpResponse.json([
      { id: 1, name: 'Food', icon: 'utensils', color: '#FF6B6B' },
      { id: 2, name: 'Transport', icon: 'car', color: '#4ECDC4' },
    ]);
  }),

  http.post(`${API_BASE}/api/categories`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: 3, ...body }, { status: 201 });
  }),

  http.put(`${API_BASE}/api/categories/:id`, async ({ params, request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: params.id, ...body });
  }),

  http.delete(`${API_BASE}/api/categories/:id`, () => {
    return HttpResponse.json({ success: true });
  }),

  // Transactions
  http.get(`${API_BASE}/api/transactions`, ({ request }) => {
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

  http.post(`${API_BASE}/api/transactions`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: 3, ...body }, { status: 201 });
  }),

  http.put(`${API_BASE}/api/transactions/:id`, async ({ params, request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: params.id, ...body });
  }),

  http.delete(`${API_BASE}/api/transactions/:id`, () => {
    return HttpResponse.json({ success: true });
  }),

  // Dashboard stats
  http.get(`${API_BASE}/api/dashboard/stats`, () => {
    return HttpResponse.json({
      totalBalance: 1500,
      monthlyIncome: 3000,
      monthlyExpenses: 1200,
      transactionCount: 45,
    });
  }),

  http.get(`${API_BASE}/api/dashboard/recent`, () => {
    return HttpResponse.json([
      { id: 1, amount: 50, description: 'Groceries', date: '2026-02-20', category: { name: 'Food' } },
      { id: 2, amount: 30, description: 'Bus fare', date: '2026-02-19', category: { name: 'Transport' } },
    ]);
  }),

  // Goals
  http.get(`${API_BASE}/api/goals`, () => {
    return HttpResponse.json([
      { id: 1, name: 'Emergency Fund', target_amount: 5000, current_amount: 2500, deadline: '2026-12-31', category_id: null },
      { id: 2, name: 'Vacation', target_amount: 2000, current_amount: 500, deadline: '2026-06-30', category_id: null },
    ]);
  }),

  http.post(`${API_BASE}/api/goals`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: 3, ...body }, { status: 201 });
  }),

  http.put(`${API_BASE}/api/goals/:id`, async ({ params, request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: params.id, ...body });
  }),

  http.post(`${API_BASE}/api/goals/:id/contribute`, async ({ params, request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: params.id, current_amount: body.amount, success: true });
  }),

  http.delete(`${API_BASE}/api/goals/:id`, () => {
    return HttpResponse.json({ success: true });
  }),

  // Duplicates
  http.get(`${API_BASE}/api/duplicates`, () => {
    return HttpResponse.json({
      duplicates: [],
      total: 0,
    });
  }),

  http.post(`${API_BASE}/api/duplicates/scan`, () => {
    return HttpResponse.json({ scanned: 0, found: 0 });
  }),

  http.post(`${API_BASE}/api/duplicates/merge`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ merged: body.ids?.length || 0 });
  }),

  // Calendar
  http.get(`${API_BASE}/api/calendar/month`, ({ request }) => {
    const url = new URL(request.url);
    const year = url.searchParams.get('year') || '2026';
    const month = url.searchParams.get('month') || '2';
    
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
  http.get(`${API_BASE}/api/backup/export`, () => {
    return HttpResponse.json({
      accounts: [],
      categories: [],
      transactions: [],
      goals: [],
      exported_at: new Date().toISOString(),
    });
  }),

  http.post(`${API_BASE}/api/backup/import`, () => {
    return HttpResponse.json({ imported: 0, errors: [] });
  }),

  // Recurring Expenses
  http.get(`${API_BASE}/recurring-expenses`, () => {
    return HttpResponse.json([
      { id: 1, name: 'Netflix', amount: 199, currency: 'INR', frequency: 'monthly', category_id: 1, next_due_date: '2026-03-01', is_active: true, auto_detected: false, alert_days_before: 3, start_date: '2026-01-01', category_name: 'Entertainment' },
      { id: 2, name: 'Internet Bill', amount: 999, currency: 'INR', frequency: 'monthly', category_id: 2, next_due_date: '2026-03-05', is_active: true, auto_detected: false, alert_days_before: 3, start_date: '2026-01-01', category_name: 'Utilities' },
      { id: 3, name: 'Spotify', amount: 399, currency: 'INR', frequency: 'monthly', category_id: 1, next_due_date: '2026-03-10', is_active: false, auto_detected: true, alert_days_before: 3, start_date: '2026-01-01', category_name: 'Entertainment' },
    ]);
  }),

  http.get(`${API_BASE}/recurring-expenses/stats/summary`, () => {
    return HttpResponse.json({
      total_active: 2,
      upcoming_count: 1,
      overdue_count: 0,
      monthly_total: 1198,
      by_frequency: { monthly: { count: 2, total: 1198 } },
      by_category: []
    });
  }),

  http.post(`${API_BASE}/recurring-expenses`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: 4, ...body }, { status: 201 });
  }),

  http.patch(`${API_BASE}/recurring-expenses/:id`, async ({ params, request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: params.id, ...body });
  }),

  http.delete(`${API_BASE}/recurring-expenses/:id`, () => {
    return HttpResponse.json({ success: true });
  }),

  // Analytics
  http.get(`${API_BASE}/api/analytics/spending-by-category`, () => {
    return HttpResponse.json([
      { category: 'Food', amount: 500, percentage: 35 },
      { category: 'Transport', amount: 200, percentage: 14 },
      { category: 'Entertainment', amount: 150, percentage: 10 },
    ]);
  }),

  http.get(`${API_BASE}/api/analytics/monthly-trend`, ({ request }) => {
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
  http.get(`${API_BASE}/api/review/count`, () => {
    return HttpResponse.json({ count: 0 });
  }),

  // Reports
  http.get(`${API_BASE}/api/reports/by-account`, () => {
    return HttpResponse.json([
      { account_id: 1, account_name: 'Test Bank', total_income: 3000, total_expenses: 500, balance: 1000 },
      { account_id: 2, account_name: 'Cash', total_income: 500, total_expenses: 200, balance: 500 },
    ]);
  }),
);
