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


def _extract_json(text: str, allow_partial: bool = False) -> Optional[Dict[str, Any]]:
    """
    Extract JSON object from text. Handles markdown code blocks and partial JSON.
    
    Args:
        text: The text to extract JSON from
        allow_partial: If True, try to extract partial JSON (for truncated responses)
        
    Returns:
        Parsed JSON dict or None if extraction failed
    """
    if not text or not text.strip():
        return None
    
    # Method 1: Try parsing the entire text as JSON
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass
    
    # Method 2: Look for JSON in markdown code blocks
    # Match content between ``` or ```json fences
    code_block_match = re.search(
        r'^```(?:json)?\s*\n?(.*?)\s*```\s*$', 
        text.strip(), 
        re.DOTALL
    )
    if code_block_match:
        code_content = code_block_match.group(1)
        try:
            return json.loads(code_content.strip())
        except json.JSONDecodeError:
            pass
    
    # Method 3: Find outermost JSON object by brace counting
    start = text.find('{')
    if start == -1:
        return None
        
    brace_count = 0
    end = start
    for i, char in enumerate(text[start:], start):
        if char == '{':
            brace_count += 1
        elif char == '}':
            brace_count -= 1
            if brace_count == 0:
                end = i + 1
                break
    
    json_str = text[start:end]
    if not json_str:
        return None
        
    try:
        return json.loads(json_str)
    except json.JSONDecodeError:
        if not allow_partial:
            return None
        
        # Method 4: Try to extract partial JSON (for truncated responses)
        # Try adding closing braces/brackets to make it valid JSON
        fixed_json = json_str
        
        # Count unclosed braces
        open_braces = json_str.count('{') - json_str.count('}')
        for _ in range(open_braces):
            fixed_json += '}'
        
        # Count unclosed brackets
        open_brackets = json_str.count('[') - json_str.count(']')
        for _ in range(open_brackets):
            fixed_json += ']'
        
        # Remove trailing commas before closing braces
        fixed_json = re.sub(r',\s*}', '}', fixed_json)
        fixed_json = re.sub(r',\s*]', ']', fixed_json)
        
        try:
            return json.loads(fixed_json)
        except json.JSONDecodeError:
            return None


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
    """Build the Gemini prompt for categorization."""
    new_category_instruction = """
5. If none of the existing categories fit well, you MAY suggest a NEW category/subcategory
   - Set "is_new_category": true and/or "is_new_subcategory": true
   - Make the new names clear, concise, and consistent with existing naming style""" if allow_new else ""

    return f"""You are a financial transaction categorizer for Indian bank/credit card statements.

Given a transaction description and amount, categorize it into the most appropriate category and subcategory.

IMPORTANT RULES:
1. Return ONLY valid JSON
2. PREFER using existing categories/subcategories when they fit reasonably well
3. Suggest a "regex_pattern" that could identify similar transactions
4. Amounts that are CREDITS (+ve) from company names are usually dividends or refunds{new_category_instruction}

Available Categories:
{categories_json}

Transaction:
- Description: {description}
- Amount: ₹{abs(amount):.2f} ({'debit/expense' if amount < 0 else 'credit/income'})

Respond with ONLY JSON:
{{"category": "Name", "subcategory": "Name", "regex_pattern": "PATTERN", "is_new_category": false, "is_new_subcategory": false, "confidence": "high"}}"""


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
                    "maxOutputTokens": 1024,
                }
            },
            timeout=10.0,
        )
        
        if response.status_code != 200:
            return None
        
        data = response.json()
        
        # Check if response was truncated
        candidates = data.get("candidates", [{}])
        if not candidates:
            return None
        
        finish_reason = candidates[0].get("finishReason", "")
        content = candidates[0].get("content", {})
        text = content.get("parts", [{}])[0].get("text", "")
        
        if finish_reason == "MAX_TOKENS":
            # Response was truncated - try to extract partial JSON
            result = _extract_json(text, allow_partial=True)
        else:
            result = _extract_json(text, allow_partial=False)
        
        if result is None:
            return None
            
        # Extract fields
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
        
        # If category doesn't exist
        if not category:
            if is_new_category and allow_new_categories and transaction_id:
                _create_suggestion(
                    conn, transaction_id, user_id, category_name, subcategory_name,
                    None, None, regex_pattern, confidence
                )
                return None
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
                _create_suggestion(
                    conn, transaction_id, user_id, category_name, subcategory_name,
                    category["id"], None, regex_pattern, confidence
                )
                return None
            else:
                # Find first subcategory
                subcategory = conn.execute(
                    "SELECT id FROM subcategories WHERE category_id = ? AND user_id = ? LIMIT 1",
                    (category["id"], user_id)
                ).fetchone()
                if not subcategory:
                    return None
        
        # Create rule for future similar transactions
        if regex_pattern and regex_pattern != "null" and regex_pattern != "PATTERN":
            _create_rule_from_ai(
                conn, user_id, description_norm, regex_pattern,
                category["id"], subcategory["id"], category_name, subcategory_name
            )
        
        return (category["id"], subcategory["id"])
        
    except Exception:
        # Rollback to clear the failed transaction state in PostgreSQL
        try:
            conn.rollback()
        except Exception:
            pass
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
        try:
            conn.rollback()
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
        re.compile(regex_pattern)
        
        existing = conn.execute(
            "SELECT id FROM rules WHERE pattern = ? AND user_id = ?",
            (regex_pattern, user_id)
        ).fetchone()
        
        if existing:
            return
        
        rule_name = f"AI: {category_name} - {subcategory_name[:20]}"
        
        conn.execute(
            """
            INSERT INTO rules (name, pattern, category_id, subcategory_id, priority, active, user_id)
            VALUES (?, ?, ?, ?, ?, 1, ?)
            """,
            (rule_name, regex_pattern, category_id, subcategory_id, 55, user_id),
        )
    except (re.error, Exception):
        try:
            conn.rollback()
        except Exception:
            pass


def clear_category_cache() -> None:
    """Clear the category cache (call after adding new categories)."""
    global _category_cache
    _category_cache = {}
