// Common type definitions for the expense tracker

// ===== Core Data Models =====

export interface Category {
  id: number;
  name: string;
  color?: string;
  monthly_budget?: number;
  icon?: string;
}

export interface Subcategory {
  id: number;
  category_id: number;
  name: string;
}

export interface Transaction {
  id: number;
  account_id: number;
  posted_at: string;
  amount: number;
  currency: string;
  description_raw: string;
  description_norm: string;
  category_id?: number | null;
  subcategory_id?: number | null;
  is_uncertain: boolean;
  notes?: string | null;
  account_name?: string | null;
}

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  balance?: number;
  currency?: string;
  institution?: string;
  last_synced?: string;
}

export type AccountType = 'checking' | 'savings' | 'credit' | 'investment' | 'cash' | 'card';

export interface Card {
  id: number;
  account_id: number;
  last_four: string;
  brand: string;
  expiry_month: number;
  expiry_year: number;
  is_active: boolean;
}

export interface Rule {
  id: number;
  name: string;
  match_pattern: string;
  category_id?: number | null;
  subcategory_id?: number | null;
  is_active: boolean;
  priority: number;
}

export interface RecurringExpense {
  id: number;
  description: string;
  amount: number;
  currency: string;
  frequency: RecurringFrequency;
  next_date: string;
  category_id?: number | null;
  account_id: number;
  is_active: boolean;
}

export type RecurringFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

// ===== API Response Types =====

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface DashboardSummary {
  items: TransactionSummary[];
  total_expenses: number;
  total_income: number;
  savings_rate?: number;
}

export interface TransactionSummary {
  date: string;
  amount: number;
  category_id?: number;
  category_name?: string;
}

export interface CategoryDetail {
  category: Category;
  total: number;
  count: number;
  average: number;
  subcategories: SubcategorySummary[];
  timeseries: TimeSeriesData[];
  transactions: Transaction[];
}

export interface SubcategorySummary {
  subcategory: Subcategory;
  total: number;
  count: number;
}

export interface TimeSeriesData {
  date: string;
  amount: number;
  category_id?: number;
}

// ===== Filter Types =====

export interface TransactionFilters {
  categoryId?: number;
  subcategoryId?: number;
  accountId?: number;
  startDate?: string;
  endDate?: string;
  isUncertain?: boolean;
  minAmount?: number;
  maxAmount?: number;
  searchQuery?: string;
}

// ===== Error Types =====

export interface ApiError {
  message: string;
  status?: number;
  endpoint?: string;
  recoverable: boolean;
}

// ===== UI Types =====

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}
