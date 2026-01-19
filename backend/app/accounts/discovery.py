import json
import os
from google import genai
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta, date
import io
import pdfplumber
from app.accounts.matcher import AccountMatcher


def detect_statement_account(conn, file_name: str, content: bytes, user_id: int) -> Optional[dict]:
    """
    Detect which account a statement belongs to based on file content and metadata.
    Returns the account dict if matched, else None.
    """
    ext = file_name.rsplit('.', 1)[-1].lower() if '.' in file_name else ""
    
    # Extract text based on file type
    text = ""
    if ext == "pdf":
        try:
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                for page in pdf.pages[:2]:  # Read first 2 pages
                    text += (page.extract_text() or "") + "\n"
        except Exception:
            pass
    else:
        # Text-based files (csv, txt, etc.)
        try:
            text = content[:10000].decode('utf-8', errors='ignore')
        except Exception:
            pass
            
    matcher = AccountMatcher(conn, user_id=user_id)
    matched_account = matcher.detect_account_from_text(text, file_name)
    
    if matched_account:
        return matched_account
        
    return None


def _to_datetime(val):
    """Ensure value is a datetime object."""
    if isinstance(val, datetime):
        return val
    if isinstance(val, date):
        return datetime.combine(val, datetime.min.time())
    if isinstance(val, str):
        return datetime.fromisoformat(val.replace('Z', '+00:00'))
    return val

def refine_account_metadata(conn, account_id: int, user_id: int):
    """
    Uses Gemini to analyze recent transactions for an account and update its metadata.
    This helps the system 'self-heal' if statement formats or payment narrations change.
    """
    # 1. Check if we've updated recently to save on AI calls
    acc = conn.execute("SELECT name, metadata, type FROM accounts WHERE id = ? AND user_id = ?", (account_id, user_id)).fetchone()
    if not acc:
        return
    
    meta = json.loads(acc["metadata"] or "{}")
    last_updated = meta.get("last_ai_update")
    if last_updated:
        last_dt = _to_datetime(last_updated)
        if datetime.now() - last_dt < timedelta(days=7):
            # Already refined within the last week
            return

    # 2. Get samples
    txns = conn.execute(
        "SELECT description_raw FROM transactions WHERE account_id = ? AND user_id = ? ORDER BY posted_at DESC LIMIT 50",
        (account_id, user_id)
    ).fetchall()
    if not txns:
        return
        
    txn_texts = [r["description_raw"] for r in txns]
    
    # 3. Use Gemini
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return
        
    client = genai.Client(api_key=api_key)
    
    prompt = f"""
    Analyze these transaction descriptions for the account '{acc["name"]}'. 
    This account is of type '{acc["type"]}'.

    CRITICAL RULES:
    1. DO NOT include merchant names (e.g., Zomato, Swiggy, Amazon) as payment_markers or stmt_markers unless they are part of the CARD NAME itself (like 'AMAZON ICICI').
    2. payment_markers: These MUST be phrases found in a BANK account narration when paying this card bill. Look for patterns like 'HDFCSI', 'AUTOPAY', or specific card suffixes mentioned in the narration.
    3. card_suffix: Extract the LAST 4 digits of the card number if clearly visible.
    4. stmt_markers: Phrases that uniquely identify this specific credit card statement file (e.g., 'Regalia Gold').

    Descriptions:
    {json.dumps(txn_texts, indent=2)}

    Return ONLY a JSON object:
    {{
        "card_suffix": "4 digits string or null",
        "stmt_markers": ["unique", "stmt", "markers"],
        "payment_markers": ["bank", "narration", "payment", "markers"],
        "filename_patterns": ["likely", "filename", "slugs"]
    }}
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-3-flash-preview',
            contents=prompt
        )
        text = response.text


        start = text.find('{')
        end = text.rfind('}') + 1
        new_meta = json.loads(text[start:end])
        
        # Merge safely
        for key in ["stmt_markers", "payment_markers", "filename_patterns"]:
            existing = set(meta.get(key, []))
            existing.update(new_meta.get(key, []))
            meta[key] = list(existing)
            
        if new_meta.get("card_suffix"):
            meta["card_suffix"] = new_meta["card_suffix"]
            
        meta["last_ai_update"] = datetime.now().isoformat()
        
        conn.execute("UPDATE accounts SET metadata = ? WHERE id = ? AND user_id = ?", (json.dumps(meta), account_id, user_id))
        conn.commit()
    except Exception as e:
        print(f"Error refining metadata for account {account_id}: {e}")
