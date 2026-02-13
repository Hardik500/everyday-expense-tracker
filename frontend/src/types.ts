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
