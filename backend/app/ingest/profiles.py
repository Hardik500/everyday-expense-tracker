from typing import Dict, Optional


# Profile definitions for different bank statement formats
# Each profile maps standard field names to the actual column names in the statement

PROFILE_DEFINITIONS: Dict[str, Dict[str, str]] = {
    # Generic profile for standard CSV/XLS with common column names
    "generic": {
        "date": "date",
        "description": "description",
        "amount": "amount",
        "currency": "currency",
        "debit": "debit",
        "credit": "credit",
    },
    
    # HDFC Bank statement format
    "hdfc": {
        "date": "Date",
        "description": "Narration",
        "debit": "Withdrawal Amt.",
        "credit": "Deposit Amt.",
        "balance": "Closing Balance",
    },
    
    # ICICI Bank statement format
    "icici": {
        "date": "Transaction Date",
        "description": "Transaction Remarks",
        "debit": "Withdrawal Amount (INR )",
        "credit": "Deposit Amount (INR )",
        "balance": "Balance (INR )",
    },
    
    # SBI Bank statement format
    "sbi": {
        "date": "Txn Date",
        "description": "Description",
        "debit": "Debit",
        "credit": "Credit",
        "balance": "Balance",
    },
    
    # Axis Bank statement format
    "axis": {
        "date": "Tran Date",
        "description": "Particulars",
        "debit": "Debit",
        "credit": "Credit",
        "balance": "Balance",
    },
    
    # Kotak Bank statement format
    "kotak": {
        "date": "Date",
        "description": "Description",
        "debit": "Debit",
        "credit": "Credit",
        "balance": "Balance",
    },
    
    # Yes Bank statement format
    "yesbank": {
        "date": "Transaction Date",
        "description": "Description",
        "debit": "Debit Amount",
        "credit": "Credit Amount",
        "balance": "Running Balance",
    },
    
    # Credit card statement generic format
    "creditcard": {
        "date": "Transaction Date",
        "description": "Transaction Details",
        "amount": "Amount",
    },
    
    # HDFC Credit Card format
    "hdfc_cc": {
        "date": "Date",
        "description": "Transaction Description",
        "amount": "Amount (in Rs.)",
    },
    
    # ICICI Credit Card format
    "icici_cc": {
        "date": "Transaction Date",
        "description": "Transaction Description",
        "amount": "Amount",
    },
}

# Column name variations for auto-detection
COLUMN_ALIASES = {
    "date": ["date", "txn date", "transaction date", "posting date", "tran date", "value date"],
    "description": ["description", "narration", "particulars", "transaction details", "remarks", "transaction remarks", "transaction description"],
    "debit": ["debit", "withdrawal", "withdrawal amt", "withdrawal amt.", "withdrawal amount", "dr", "debit amount"],
    "credit": ["credit", "deposit", "deposit amt", "deposit amt.", "deposit amount", "cr", "credit amount"],
    "amount": ["amount", "transaction amount", "amount (in rs.)", "amount(inr)"],
    "balance": ["balance", "closing balance", "running balance", "available balance"],
}


def resolve_profile(profile: Optional[str]) -> Dict[str, str]:
    """Get the column mapping for a given profile."""
    if not profile:
        return PROFILE_DEFINITIONS["generic"]
    
    profile_lower = profile.lower().strip()
    
    # Try exact match first
    if profile_lower in PROFILE_DEFINITIONS:
        return PROFILE_DEFINITIONS[profile_lower]
    
    # Try partial matches
    for key in PROFILE_DEFINITIONS:
        if key in profile_lower or profile_lower in key:
            return PROFILE_DEFINITIONS[key]
    
    # Fall back to generic
    return PROFILE_DEFINITIONS["generic"]


def detect_profile(columns: list) -> Dict[str, str]:
    """
    Auto-detect column mapping from actual column names.
    Returns a mapping dict suitable for data extraction.
    """
    columns_lower = [str(c).lower().strip() for c in columns]
    mapping = {}
    
    for field, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            for i, col in enumerate(columns_lower):
                if alias in col:
                    mapping[field] = columns[i]  # Use original column name
                    break
            if field in mapping:
                break
    
    return mapping
