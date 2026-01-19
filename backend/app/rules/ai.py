"""
AI-powered transaction categorization using Google Gemini.
Falls back to None if no API key is configured or rate-limited.
"""
import json
import os
import re
from typing import Optional, Tuple, Dict, Any

import httpx


GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent"

# Cache for category/subcategory lookups per user to avoid repeated DB queries
_category_cache: Dict[int, dict] = {}


def _get_categories_json(conn, user_id: int) -> str:
    """Build a JSON representation of all categories and subcategories for a user."""
    global _category_cache
    
    if user_id in _category_cache:
        return json.dumps(_category_cache[user_id], indent=2)
    
    categories = conn.execute(
        "SELECT id, name FROM categories WHERE user_id = ? ORDER BY name",
        (user_id,)
    ).fetchall()
    subcategories = conn.execute(
        "SELECT id, category_id, name FROM subcategories WHERE user_id = ? ORDER BY name",
        (user_id,)
    ).fetchall()
    
    result = {}
    for cat in categories:
        cat_subs = [
            {"id": sub["id"], "name": sub["name"]}
            for sub in subcategories
            if sub["category_id"] == cat["id"]
        ]
        result[cat["name"]] = {
            "id": cat["id"],
            "subcategories": cat_subs
        }
    
    _category_cache[user_id] = result
    return json.dumps(result, indent=2)


def _build_prompt(description: str, amount: float, categories_json: str, allow_new: bool = True) -> str:
    """Build the prompt for Gemini."""
    new_category_instruction = """
5. If none of the existing categories fit well, you MAY suggest a NEW category/subcategory
   - Set "is_new_category": true and/or "is_new_subcategory": true
   - Make the new names clear, concise, and consistent with existing naming style
""" if allow_new else ""

    return f"""You are a financial transaction categorizer for Indian bank/credit card statements.

Given a transaction description and amount, categorize it into the most appropriate category and subcategory.

IMPORTANT CONTEXT FOR INDIAN BANKING:
- "ACH C-" prefix means an incoming credit via ACH (could be dividend, salary, refund, etc.)
- "ACH D-" prefix means an outgoing debit via ACH
- Company names followed by account numbers often indicate DIVIDENDS from stock investments
- "NEFT", "RTGS", "IMPS", "UPI" are transfer methods
- "POS" means point-of-sale card transaction
- Amounts that are CREDITS (+ve) from company names are usually dividends or refunds

IMPORTANT RULES:
1. Return ONLY valid JSON
2. PREFER using existing categories/subcategories when they fit reasonably well
3. Suggest a "regex_pattern" that could identify similar transactions in the future
4. The regex should be simple and capture the key merchant/vendor name
5. For credits from companies (especially with account numbers), consider "Income > Dividend"{new_category_instruction}

Available Categories and Subcategories:
{categories_json}

Transaction to categorize:
- Description: {description}
- Amount: ₹{abs(amount):.2f} ({'debit/expense' if amount < 0 else 'credit/income'})

Respond with ONLY a JSON object:
{{
  "category": "Category Name",
  "subcategory": "Subcategory Name", 
  "regex_pattern": "PATTERN",
  "is_new_category": false,
  "is_new_subcategory": false,
  "confidence": "high"
}}

Set confidence to "high", "medium", or "low" based on how certain you are."""


def ai_classify(
    description_norm: str,
    amount: float,
    conn=None,
    user_id: Optional[int] = None,
    transaction_id: Optional[int] = None,
    allow_new_categories: bool = True,
) -> Optional[Tuple[int, int]]:
    """
    Use Google Gemini to classify a transaction.
    Returns (category_id, subcategory_id) tuple or None if classification fails.
    
    If AI suggests a new category/subcategory and allow_new_categories=True,
    creates a suggestion record for user approval.
    
    Also creates a rule from the AI's suggestion to avoid future API calls.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None
    
    if not conn:
        return None
    
    try:
        if not user_id:
            return None
            
        categories_json = _get_categories_json(conn, user_id)
        prompt = _build_prompt(description_norm, amount, categories_json, allow_new=allow_new_categories)
        
        response = httpx.post(
            f"{GEMINI_API_URL}?key={api_key}",
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.1,
                    "topK": 1,
                    "topP": 0.8,
                    "maxOutputTokens": 256,
                }
            },
            timeout=10.0,
        )
        
        if response.status_code != 200:
            return None
        
        data = response.json()
        text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        
        # Extract JSON from response (handle markdown code blocks)
        json_match = re.search(r'\{[^{}]*\}', text, re.DOTALL)
        if not json_match:
            return None
        
        result = json.loads(json_match.group())
        category_name = result.get("category")
        subcategory_name = result.get("subcategory")
        regex_pattern = result.get("regex_pattern")
        is_new_category = result.get("is_new_category", False)
        is_new_subcategory = result.get("is_new_subcategory", False)
        confidence = result.get("confidence", "medium")
        
        if not category_name or not subcategory_name:
            return None
        
        # Look up category
        category = conn.execute(
            "SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND user_id = ?",
            (category_name, user_id)
        ).fetchone()
        
        # If category doesn't exist and AI suggested new one
        if not category:
            if is_new_category and allow_new_categories and transaction_id:
                # Create a suggestion for user approval
                _create_suggestion(
                    conn, transaction_id, user_id, category_name, subcategory_name,
                    None, None, regex_pattern, confidence
                )
                return None  # Don't categorize yet, wait for approval
            else:
                # Fall back to Miscellaneous
                category = conn.execute(
                    "SELECT id FROM categories WHERE name = 'Miscellaneous' AND user_id = ?",
                    (user_id,)
                ).fetchone()
                if not category:
                    return None
        
        # Look up subcategory
        subcategory = conn.execute(
            "SELECT id FROM subcategories WHERE category_id = ? AND LOWER(name) = LOWER(?) AND user_id = ?",
            (category["id"], subcategory_name, user_id)
        ).fetchone()
        
        if not subcategory:
            if is_new_subcategory and allow_new_categories and transaction_id:
                # Create a suggestion for new subcategory
                _create_suggestion(
                    conn, transaction_id, user_id, category_name, subcategory_name,
                    category["id"], None, regex_pattern, confidence
                )
                return None  # Don't categorize yet, wait for approval
            else:
                # Try to find first subcategory in this category, or use "Other"
                subcategory = conn.execute(
                    "SELECT id FROM subcategories WHERE category_id = ? AND name LIKE '%Other%' AND user_id = ? LIMIT 1",
                    (category["id"], user_id)
                ).fetchone()
                if not subcategory:
                    subcategory = conn.execute(
                        "SELECT id FROM subcategories WHERE category_id = ? AND user_id = ? LIMIT 1",
                        (category["id"], user_id)
                    ).fetchone()
                if not subcategory:
                    return None
        
        # Create a rule from the AI's suggestion to avoid future API calls
        if regex_pattern and regex_pattern != "null":
            _create_rule_from_ai(
                conn,
                user_id,
                description_norm,
                regex_pattern,
                category["id"],
                subcategory["id"],
                category_name,
                subcategory_name if not is_new_subcategory else subcategory_name,
            )
        
        return (category["id"], subcategory["id"])
        
    except Exception as e:
        return None


def _create_suggestion(
    conn,
    transaction_id: int,
    user_id: int,
    category_name: str,
    subcategory_name: str,
    existing_category_id: Optional[int],
    existing_subcategory_id: Optional[int],
    regex_pattern: Optional[str],
    confidence: str,
) -> None:
    """Create an AI suggestion record for user approval."""
    try:
        # Check if suggestion already exists for this transaction
        existing = conn.execute(
            "SELECT id FROM ai_suggestions WHERE transaction_id = ? AND status = 'pending' AND user_id = ?",
            (transaction_id, user_id)
        ).fetchone()
        
        if existing:
            return
        
        conn.execute(
            """
            INSERT INTO ai_suggestions (
                transaction_id, user_id, suggested_category, suggested_subcategory,
                existing_category_id, existing_subcategory_id, regex_pattern, confidence
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (transaction_id, user_id, category_name, subcategory_name,
             existing_category_id, existing_subcategory_id, regex_pattern, confidence),
        )
    except Exception:
        pass


def _create_rule_from_ai(
    conn,
    user_id: int,
    description_norm: str,
    regex_pattern: str,
    category_id: int,
    subcategory_id: int,
    category_name: str,
    subcategory_name: str,
) -> None:
    """Create a rule from AI classification to avoid future API calls."""
    try:
        # Validate the regex pattern
        re.compile(regex_pattern)
        
        # Check if rule already exists
        existing = conn.execute(
            "SELECT id FROM rules WHERE pattern = ? AND user_id = ?",
            (regex_pattern, user_id)
        ).fetchone()
        
        if existing:
            return
        
        # Create a readable name from the pattern
        rule_name = f"AI: {category_name} - {subcategory_name[:20]}"
        
        conn.execute(
            """
            INSERT INTO rules (name, pattern, category_id, subcategory_id, priority, active, user_id)
            VALUES (?, ?, ?, ?, ?, 1, ?)
            """,
            (rule_name, regex_pattern, category_id, subcategory_id, 55, user_id),
        )
        
    except (re.error, Exception):
        # Invalid regex or other error - skip rule creation
        pass


def clear_category_cache() -> None:
    """Clear the category cache (call after adding new categories)."""
    global _category_cache
    _category_cache = {}
