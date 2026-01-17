import json
import re
from typing import List, Dict, Any, Optional

class AccountMatcher:
    def __init__(self, db_conn):
        self.conn = db_conn
        self.accounts = self._load_accounts()

    def _load_accounts(self) -> List[Dict[str, Any]]:
        rows = self.conn.execute("SELECT id, name, type, metadata FROM accounts").fetchall()
        accounts = []
        for r in rows:
            meta = json.loads(r["metadata"] or "{}")
            accounts.append({
                "id": r["id"],
                "name": r["name"],
                "type": r["type"],
                "metadata": meta
            })
        return accounts

    def detect_account_from_text(self, text: str, file_name: str = "") -> Optional[Dict[str, Any]]:
        text_lower = text.lower()
        file_name_lower = file_name.lower()

        # Priority 1: Filename matches
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

        # Priority 2: Content markers
        for acc in self.accounts:
            meta = acc["metadata"]
            for marker in meta.get("stmt_markers", []):
                if marker.lower() in text_lower:
                    return acc

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
