import json
import os
import re
from typing import List, Tuple, Optional
import httpx

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

def parse_with_gemini(text: str) -> List[Tuple[str, str, float, bool]]:
    """
    Use Google Gemini to parse transactions from raw statement text.
    Returns a list of (date_str, description, amount, is_credit) tuples.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("Gemini API key not found. Skipping AI parsing.")
        return []

    # Limit text length to avoid token limits (though Gemini has large context, stay safe)
    # 100k chars is usually plenty for a statement page
    text_chunk = text[:100000]

    prompt = f"""
    You are an expert data extraction agent. Your job is to extract financial transactions from the provided bank/credit card statement text.

    EXTRACT THESE FIELDS FOR EACH TRANSACTION:
    1. Date: In DD/MM/YYYY format. If year is missing in text, assume current year or infer from context (header usually has statement dates).
    2. Description: The merchant name or transaction details.
    3. Amount: The numeric value (positive float).
    4. Type: "credit" (payment/refund) or "debit" (purchase/expense).

    RULES:
    - Return ONLY a raw JSON list of objects. No markdown formatting.
    - Keys: "date", "description", "amount", "type".
    - Ignore summary tables (totals, opening balance), headers, footers.
    - Default to "debit" if unsure, unless it explicitly says "Cr" or "Credit".
    - If a line is just a date or amount without context, ignore it.
    - Handle multi-line transactions intelligently.

    TEXT TO PARSE:
    {text_chunk}
    """

    try:
        response = httpx.post(
            f"{GEMINI_API_URL}?key={api_key}",
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.1,
                    "responseMimeType": "application/json"
                }
            },
            timeout=30.0,
        )

        if response.status_code != 200:
            print(f"Gemini API error: {response.status_code} - {response.text}")
            return []

        data = response.json()
        candidate = data.get("candidates", [{}])[0]
        content = candidate.get("content", {}).get("parts", [{}])[0].get("text", "")
        
        # Clean potential markdown
        content = content.replace("```json", "").replace("```", "").strip()
        
        txs_json = json.loads(content)
        
        results = []
        for tx in txs_json:
            date_str = tx.get("date")
            desc = tx.get("description")
            amount = tx.get("amount")
            tx_type = tx.get("type", "debit").lower()
            
            if not date_str or not desc or amount is None:
                continue
                
            try:
                # Ensure date is DD/MM/YYYY
                # If AI returns YYYY-MM-DD, convert it
                if "-" in date_str and date_str.index("-") == 4: # 2024-01-01
                     parts = date_str.split("-")
                     date_str = f"{parts[2]}/{parts[1]}/{parts[0]}"
                
                amount_float = float(amount)
                is_credit = tx_type in ["credit", "cr"]
                
                results.append((date_str, desc, amount_float, is_credit))
            except Exception:
                continue
                
        return results

    except Exception as e:
        print(f"AI Parsing failed: {e}")
        return []
