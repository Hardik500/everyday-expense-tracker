from datetime import date, datetime
from typing import Optional, Dict, Any, Union

from pydantic import BaseModel, Field


class AccountCreate(BaseModel):
    name: str
    type: str = Field(pattern="^(bank|card|cash)$")
    currency: str = "INR"


class User(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    disabled: Optional[bool] = None
    created_at: Union[datetime, str]
    # Gmail integration fields
    gmail_enabled: bool = False
    gmail_last_sync: Optional[datetime] = None
    gmail_filter_query: Optional[str] = None

class GmailConfigUpdate(BaseModel):
    gmail_enabled: Optional[bool] = None
    gmail_filter_query: Optional[str] = None

class GoogleAuthUrl(BaseModel):
    url: str

class UserCreate(BaseModel):
    username: str
    password: str
    email: Optional[str] = None
    full_name: Optional[str] = None

class UserUpdate(BaseModel):
    username: Optional[str] = None
    full_name: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class Account(BaseModel):
    id: int
    name: str
    type: str
    currency: str
    upgraded_from_id: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    upgraded_from_id: Optional[int] = None


class Category(BaseModel):
    id: int
    name: str
    color: Optional[str] = None
    monthly_budget: Optional[float] = None
    icon: Optional[str] = None


class Subcategory(BaseModel):
    id: int
    category_id: int
    name: str


class Transaction(BaseModel):
    id: int
    account_id: int
    posted_at: date
    amount: float
    currency: str
    description_raw: str
    description_norm: str
    category_id: Optional[int]
    subcategory_id: Optional[int]
    is_uncertain: bool
    notes: Optional[str] = None
    account_name: Optional[str] = None


class TransactionUpdate(BaseModel):
    category_id: Optional[int] = None
    subcategory_id: Optional[int] = None
    notes: Optional[str] = None
    create_mapping: bool = False


class RuleCreate(BaseModel):
    name: str
    pattern: str
    category_id: int
    subcategory_id: Optional[int] = None
    min_amount: Optional[float] = None
    max_amount: Optional[float] = None
    priority: int = 50
    account_type: Optional[str] = None
    merchant_contains: Optional[str] = None



class ReportItem(BaseModel):
    category_id: int
    category_name: str
    total: float


class SearchRequest(BaseModel):
    query: Optional[str] = None
    filters: Optional[Dict[str, Any]] = None
    page: int = 1
    page_size: int = 50


# Recurring Expense Schemas
class RecurringExpenseCreate(BaseModel):
    name: str
    description: Optional[str] = None
    amount: float
    currency: str = "INR"
    frequency: str = Field(pattern="^(daily|weekly|monthly|quarterly|yearly|custom)$")
    interval_days: Optional[int] = None
    category_id: Optional[int] = None
    subcategory_id: Optional[int] = None
    account_id: Optional[int] = None
    start_date: date
    end_date: Optional[date] = None
    alert_days_before: int = 3
    merchant_pattern: Optional[str] = None


class RecurringExpenseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    frequency: Optional[str] = Field(pattern="^(daily|weekly|monthly|quarterly|yearly|custom)$", default=None)
    interval_days: Optional[int] = None
    category_id: Optional[int] = None
    subcategory_id: Optional[int] = None
    account_id: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None
    alert_days_before: Optional[int] = None
    merchant_pattern: Optional[str] = None


class RecurringPayment(BaseModel):
    id: int
    recurring_expense_id: int
    transaction_id: Optional[int] = None
    scheduled_date: date
    paid_date: Optional[date] = None
    expected_amount: float
    actual_amount: Optional[float] = None
    status: str
    notes: Optional[str] = None


class RecurringExpense(BaseModel):
    id: int
    user_id: int
    name: str
    description: Optional[str] = None
    amount: float
    currency: str
    frequency: str
    interval_days: Optional[int] = None
    category_id: Optional[int] = None
    subcategory_id: Optional[int] = None
    account_id: Optional[int] = None
    start_date: date
    end_date: Optional[date] = None
    next_due_date: date
    previous_due_date: Optional[date] = None
    is_active: bool
    auto_detected: bool
    merchant_pattern: Optional[str] = None
    alert_days_before: int
    created_at: Union[datetime, str]
    updated_at: Union[datetime, str]
    # Joined fields
    category_name: Optional[str] = None
    subcategory_name: Optional[str] = None
    account_name: Optional[str] = None
    # Computed fields
    upcoming_payments: Optional[List[RecurringPayment]] = None


class RecurringExpenseStats(BaseModel):
    total_active: int
    total_monthly: float
    upcoming_count: int
    overdue_count: int
    by_frequency: Dict[str, int]
    by_category: List[Dict[str, Any]]

