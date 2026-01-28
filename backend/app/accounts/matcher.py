import json
import re
from typing import List, Dict, Any, Optional
class AccountMatcher:
    GLOBAL_SIGNATURES = [
        {"name": "HDFC Bank Savings", "type": "bank", "markers": ["HDFC BANK", "HDFC Savings", "Statement for HDFC"]},
        {"name": "ICICI Bank Savings", "type": "bank", "markers": ["ICICI BANK", "ICICI Savings", "ICICI Statement"]},
        {"name": "SBI Savings", "type": "bank", "markers": ["STATE BANK OF INDIA", "SBI Statement", "SBI Savings"]},
        {"name": "Axis Bank Savings", "type": "bank", "markers": ["AXIS BANK", "Axis Statement"]},
        {"name": "Amazon ICICI Card", "type": "card", "markers": ["AMAZON ICICI", "ICICI CREDIT CARD", "CARD STATEMENT"], "card_suffix": "card"},
        {"name": "OneCard", "type": "card", "markers": ["ONECARD", "FPL TECHNOLOGIES"]},
        {"name": "Swiggy HDFC Card", "type": "card", "markers": ["SWIGGY HDFC", "HDFC CREDIT CARD"]},
    ]

    def __init__(self, db_conn, user_id: int):
        self.conn = db_conn
        self.user_id = user_id
        self.accounts = self._load_accounts()

    def _load_accounts(self) -> List[Dict[str, Any]]:
        rows = self.conn.execute(
            "SELECT id, name, type, metadata FROM accounts WHERE user_id = ?", 
            (self.user_id,)
        ).fetchall()
        accounts = []
        for r in rows:
            # Handle both SQLite (string) and PostgreSQL (dict) metadata
            raw_meta = r["metadata"]
            if raw_meta is None:
                meta = {}
            elif isinstance(raw_meta, dict):
                meta = raw_meta  # PostgreSQL JSONB returns as dict
            else:
                meta = json.loads(raw_meta)  # SQLite returns as string
            accounts.append({
                "id": r["id"],
                "name": r["name"],
                "type": r["type"],
                "metadata": meta
            })
        return accounts

    def _extract_account_hints_from_filename(self, file_name: str) -> List[str]:
        """Extract potential account names from filename."""
        if not file_name:
            return []
        
        hints = []
        file_name_clean = file_name.replace('.pdf', '').replace('.csv', '').replace('.txt', '')
        
        # Split by common separators
        parts = re.split(r'[_\-\s]+', file_name_clean)
        
        # Filter out numeric parts and common noise words
        noise_words = {'statement', 'card', 'credit', 'bank', 'unlocked', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 
                       'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'stmt'}
        
        for part in parts:
            # Skip if all digits or very short
            if part.isdigit() or len(part) < 3:
                continue
            # Skip noise words
            if part.lower() in noise_words:
                continue
            # Skip if looks like a number (even with letters like "825" or "2024")
            if re.match(r'^\d+[a-zA-Z]?$', part) or re.match(r'^[a-zA-Z]?\d+$', part):
                continue
            
            hints.append(part)
        
        return hints

    def _fuzzy_match_account_name(self, hint: str, account_name: str) -> float:
        """Calculate simple similarity score between hint and account name."""
        hint_lower = hint.lower()
        account_lower = account_name.lower()
        
        # Exact match
        if hint_lower == account_lower:
            return 1.0
        
        # Substring match
        if hint_lower in account_lower or account_lower in hint_lower:
            return 0.8
        
        # Word-level match
        hint_words = set(hint_lower.split())
        account_words = set(account_lower.split())
        if hint_words & account_words:  # Any word overlap
            return 0.6
        
        return 0.0


    def detect_account_from_text(self, text: str, file_name: str = "") -> Optional[Dict[str, Any]]:
        text_lower = text.lower()
        file_name_lower = file_name.lower()

        # Priority 1: Filename matches (existing metadata)
        for acc in self.accounts:
            meta = acc["metadata"]
            card_suffix = meta.get("card_suffix")
            
            # Check card suffix in filename
            if card_suffix and card_suffix in file_name_lower:
                return acc
            
            # Check specific filename patterns
            for pattern in meta.get("filename_patterns", []):
                if pattern.lower() in file_name_lower:
                    return acc

        # Priority 2: Content markers (existing metadata)
        for acc in self.accounts:
            meta = acc["metadata"]
            for marker in meta.get("stmt_markers", []):
                if marker.lower() in text_lower:
                    return acc

        # Priority 3: NEW - Fuzzy filename matching against user's accounts
        hints = self._extract_account_hints_from_filename(file_name)
        if hints:
            best_match = None
            best_score = 0.7  # Minimum confidence threshold
            
            for hint in hints:
                for acc in self.accounts:
                    score = self._fuzzy_match_account_name(hint, acc["name"])
                    if score > best_score:
                        best_score = score
                        best_match = acc
            
            if best_match:
                return best_match

        return None

    def suggest_account_details(self, text: str, file_name: str = "") -> Optional[Dict[str, str]]:
        """Suggest an account name and type if no existing account is matched."""
        text_lower = text.lower()
        file_name_lower = file_name.lower()

        for sig in self.GLOBAL_SIGNATURES:
            for marker in sig["markers"]:
                if marker.lower() in text_lower or marker.lower() in file_name_lower:
                    return {
                        "name": sig["name"],
                        "type": sig["type"]
                    }
        return None

    def get_payment_patterns(self, account_id: int) -> List[str]:
        for acc in self.accounts:
            if acc["id"] == account_id:
                return acc["metadata"].get("payment_markers", [])
        return []

    def is_payment_for_account(self, description: str, account_id: int) -> bool:
        """
        Check if a normalized bank transaction description belongs to a specific account.
        Uses suffix disambiguation to prevent overlaps.
        """
        desc_lower = description.lower()
        
        # 1. Check if it matches target account patterns
        target_account = next((a for a in self.accounts if a["id"] == account_id), None)
        if not target_account:
            return False
            
        target_meta = target_account["metadata"]
        target_patterns = target_meta.get("payment_markers", [])
        target_suffix = target_meta.get("card_suffix")

        # Basic membership check
        matches_target = any(p.lower() in desc_lower for p in target_patterns)
        if not matches_target:
            return False

        # 2. Disambiguation: If it contains OTHER account suffixes, it's not for us
        for acc in self.accounts:
            if acc["id"] == account_id:
                continue
            
            other_suffix = acc["metadata"].get("card_suffix")
            if other_suffix and other_suffix in desc_lower:
                # If it has other suffix, it's NOT for us (even if it matches generic HDFC pattern)
                return False

        return True

    def get_account_by_id(self, account_id: int) -> Optional[Dict[str, Any]]:
        return next((a for a in self.accounts if a["id"] == account_id), None)
