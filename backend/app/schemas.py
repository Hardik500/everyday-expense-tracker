from datetime import date
from typing import Optional, Dict, Any

from pydantic import BaseModel, Field


class AccountCreate(BaseModel):
    name: str
    type: str = Field(pattern="^(bank|card|cash)$")
    currency: str = "INR"


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
    account_name: Optional[str] = None


class TransactionUpdate(BaseModel):
    category_id: Optional[int] = None
    subcategory_id: Optional[int] = None
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

