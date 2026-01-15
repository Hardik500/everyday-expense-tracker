import json
import os
import re
from datetime import datetime
from typing import Dict, Any, List, Optional
import httpx
from app.db import get_conn

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

def _get_categories_json_search(conn) -> str:
    """Build a JSON representation of all categories and subcategories (local version)."""
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
    return json.dumps(result, indent=2)

def parse_search_query(query: str, conn) -> Dict[str, Any]:
    """
    Use Gemini to parse a natural language search query into structured filters.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return {}

    # Get context
    categories_json = _get_categories_json_search(conn)
    accounts = conn.execute("SELECT name FROM accounts").fetchall()
    account_names = [r["name"] for r in accounts]
    today = datetime.now().strftime("%Y-%m-%d")

    prompt = f"""
You are a smart search engine for personal finance transactions.
Current Date: {today}

Context:
- Available Accounts: {json.dumps(account_names)}
- Categories/Subcategories: {categories_json}

User Search Query: "{query}"

Your task is to extract structured search filters from the query.
Return *ONLY* a JSON object with the following optional keys (omit if not applicable):
- start_date: string (YYYY-MM-DD)
- end_date: string (YYYY-MM-DD)
- min_amount: number (absolute value)
- max_amount: number (absolute value)
- category: string (exact name from Available Categories)
- subcategory: string (exact name from Subcategories)
- account: string (exact name from Available Accounts)
- description: string (keywords to match in description)
- sort: string ("newest", "oldest", "highest_amount", "lowest_amount")

Logic Rules:
1. "last 30 days" -> start_date = today - 30 days, end_date = today
2. "over 500" -> min_amount = 500
3. "zomato" -> description = "zomato"
4. "HDFC" -> might be account name "HDFC Credit Card" -> account = "HDFC Credit Card"
5. If a word matches a Category name exactly, prefer category field over description.
6. If "expenses" -> only debits (amount < 0). If "income" -> only credits (amount > 0). You can imply this by min_amount/max_amount or we handle it later. For now, assume signed amounts are handled by DB query logic (expenses are negative). But user says "100-150Rs", they imply absolute magnitude. The backend handles this.

Return ONLY the JSON. No markdown formatting.
"""

    try:
        response = httpx.post(
            f"{GEMINI_API_URL}?key={api_key}",
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.0,
                    "maxOutputTokens": 256,
                }
            },
            timeout=5.0, # Fast timeout
        )
        
        if response.status_code != 200:
            return {}
            
        data = response.json()
        text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        
        # Cleanup
        text = re.sub(r"```json", "", text)
        text = re.sub(r"```", "", text).strip()
        
        return json.loads(text)
    except Exception:
        return {}

def perform_ai_search(query: str) -> Dict[str, Any]:
    with get_conn() as conn:
        filters = parse_search_query(query, conn)
        
        clauses = []
        params = []
        
        # Build SQL
        query_sql = """
            SELECT t.id, t.account_id, t.posted_at, t.amount, t.currency, 
                   t.description_raw, t.description_norm, 
                   t.category_id, t.subcategory_id, t.is_uncertain,
                   c.name as category_name, s.name as subcategory_name, a.name as account_name
            FROM transactions t
            LEFT JOIN categories c ON c.id = t.category_id
            LEFT JOIN subcategories s ON s.id = t.subcategory_id
            LEFT JOIN accounts a ON a.id = t.account_id
            WHERE 1=1
        """
        
        if filters.get("start_date"):
            clauses.append("t.posted_at >= ?")
            params.append(filters["start_date"])
            
        if filters.get("end_date"):
            clauses.append("t.posted_at <= ?")
            params.append(filters["end_date"] + " 23:59:59")
            
        if filters.get("min_amount") is not None:
            # Absolute amount comparison
            clauses.append("ABS(t.amount) >= ?")
            params.append(filters["min_amount"])
            
        if filters.get("max_amount") is not None:
             clauses.append("ABS(t.amount) <= ?")
             params.append(filters["max_amount"])
             
        if filters.get("account"):
            # Subquery or Join filter
            clauses.append("a.name LIKE ?")
            params.append(f"%{filters['account']}%")
            
        if filters.get("category"):
            clauses.append("c.name LIKE ?")
            params.append(f"%{filters['category']}%")
            
        if filters.get("subcategory"):
            clauses.append("s.name LIKE ?")
            params.append(f"%{filters['subcategory']}%")
            
        if filters.get("description"):
            term = filters["description"]
            # Search both raw and norm
            clauses.append("(t.description_raw LIKE ? OR t.description_norm LIKE ?)")
            params.append(f"%{term}%")
            params.append(f"%{term}%")
            
        # Add filtering clauses
        for clause in clauses:
            query_sql += f" AND {clause}"
            
        # Sort
        sort_mode = filters.get("sort", "newest")
        if sort_mode == "oldest":
            query_sql += " ORDER BY t.posted_at ASC"
        elif sort_mode == "highest_amount":
            query_sql += " ORDER BY ABS(t.amount) DESC"
        elif sort_mode == "lowest_amount":
            query_sql += " ORDER BY ABS(t.amount) ASC"
        else:
            query_sql += " ORDER BY t.posted_at DESC"
            
        query_sql += " LIMIT 100"
        
        rows = conn.execute(query_sql, params).fetchall()
        
        return {
            "filters": filters, # Return detailed filters so frontend can show what it understood
            "results": [dict(row) for row in rows]
        }
