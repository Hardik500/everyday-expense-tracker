"""
AI-powered transaction categorization using Google Gemini.
Falls back to None if no API key is configured or rate-limited.
"""
import json
import os
import re
from typing import Optional, Tuple

import httpx


GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

# Cache for category/subcategory lookups to avoid repeated DB queries
_category_cache: dict = {}


def _get_categories_json(conn) -> str:
    """Build a JSON representation of all categories and subcategories."""
    global _category_cache
    
    if _category_cache:
        return json.dumps(_category_cache, indent=2)
    
    categories = conn.execute(
        "SELECT id, name FROM categories ORDER BY name"
    ).fetchall()
    subcategories = conn.execute(
        "SELECT id, category_id, name FROM subcategories ORDER BY name"
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
    
    _category_cache = result
    return json.dumps(result, indent=2)


def _build_prompt(description: str, amount: float, categories_json: str) -> str:
    """Build the prompt for Gemini."""
    return f"""You are a financial transaction categorizer for Indian bank/credit card statements.

Given a transaction description and amount, categorize it into one of the available categories and subcategories.

IMPORTANT RULES:
1. Return ONLY valid JSON with "category" and "subcategory" fields matching EXACTLY the names provided
2. Also suggest a "regex_pattern" that could be used to identify similar transactions in the future
3. If you cannot confidently categorize, return {{"category": "Miscellaneous", "subcategory": "Uncategorized", "regex_pattern": null}}
4. The regex should be simple and capture the key merchant/vendor name or transaction type

Available Categories and Subcategories:
{categories_json}

Transaction to categorize:
- Description: {description}
- Amount: ₹{abs(amount):.2f} ({'debit' if amount < 0 else 'credit'})

Respond with ONLY a JSON object like:
{{"category": "Food & Dining", "subcategory": "Swiggy & Zomato", "regex_pattern": "SWIGGY|BUNDL\\\\s*TECH"}}"""


def ai_classify(
    description_norm: str,
    amount: float,
    conn=None,
) -> Optional[Tuple[int, int]]:
    """
    Use Google Gemini to classify a transaction.
    Returns (category_id, subcategory_id) tuple or None if classification fails.
    
    Also creates a rule from the AI's suggestion to avoid future API calls.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None
    
    if not conn:
        # If no connection provided, we can't look up categories
        return None
    
    try:
        categories_json = _get_categories_json(conn)
        prompt = _build_prompt(description_norm, amount, categories_json)
        
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
        
        if not category_name or not subcategory_name:
            return None
        
        # Look up IDs
        category = conn.execute(
            "SELECT id FROM categories WHERE name = ?",
            (category_name,)
        ).fetchone()
        
        if not category:
            return None
        
        subcategory = conn.execute(
            "SELECT id FROM subcategories WHERE category_id = ? AND name = ?",
            (category["id"], subcategory_name)
        ).fetchone()
        
        if not subcategory:
            # Try to find any subcategory in this category
            subcategory = conn.execute(
                "SELECT id FROM subcategories WHERE category_id = ? LIMIT 1",
                (category["id"],)
            ).fetchone()
            if not subcategory:
                return None
        
        # Create a rule from the AI's suggestion to avoid future API calls
        if regex_pattern and regex_pattern != "null":
            _create_rule_from_ai(
                conn,
                description_norm,
                regex_pattern,
                category["id"],
                subcategory["id"],
                category_name,
                subcategory_name,
            )
        
        return (category["id"], subcategory["id"])
        
    except Exception:
        return None


def _create_rule_from_ai(
    conn,
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
            "SELECT id FROM rules WHERE pattern = ?",
            (regex_pattern,)
        ).fetchone()
        
        if existing:
            return
        
        # Create a readable name from the pattern
        rule_name = f"AI: {category_name} - {subcategory_name[:20]}"
        
        conn.execute(
            """
            INSERT INTO rules (name, pattern, category_id, subcategory_id, priority, active)
            VALUES (?, ?, ?, ?, ?, 1)
            """,
            (rule_name, regex_pattern, category_id, subcategory_id, 55),
        )
        
    except (re.error, Exception):
        # Invalid regex or other error - skip rule creation
        pass


def clear_category_cache() -> None:
    """Clear the category cache (call after adding new categories)."""
    global _category_cache
    _category_cache = {}
