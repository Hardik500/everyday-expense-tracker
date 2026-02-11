"""
PHASE-5: AI Categorization Cache
Implements caching for AI categorization results to reduce API calls and improve performance.
"""
import hashlib
import json
import os
import time
from typing import Optional, Tuple, Dict, Any

# Cache configuration
CACHE_TTL = int(os.getenv("AI_CACHE_TTL", "3600"))  # 1 hour default
MAX_CACHE_SIZE = int(os.getenv("AI_CACHE_SIZE", "1000"))  # Max 1000 cached results

# In-memory cache storage
_cache: Dict[str, Dict[str, Any]] = {}


def _generate_cache_key(description_norm: str, amount: float) -> str:
    """Generate a cache key from transaction description and amount."""
    key_data = f"{description_norm.lower().strip()}|{abs(amount):.2f}"
    return hashlib.md5(key_data.encode()).hexdigest()


def get_cached_category(
    conn,
    user_id: int,
    description_norm: str,
    amount: float
) -> Optional[Tuple[int, int]]:
    """
    Check cache for existing categorization result.
    Returns (category_id, subcategory_id) or None if not cached.
    """
    cache_key = _generate_cache_key(description_norm, amount)
    full_key = f"{user_id}:{cache_key}"
    
    if full_key in _cache:
        entry = _cache[full_key]
        # Check if cache entry is still valid
        if time.time() - entry["timestamp"] < CACHE_TTL:
            category_id = entry["category_id"]
            subcategory_id = entry["subcategory_id"]
            
            # Verify IDs still exist in database
            cursor = conn.execute(
                "SELECT 1 FROM categories WHERE id = ? AND user_id = ?",
                (category_id, user_id)
            ).fetchone()
            
            if cursor:
                subcheck = conn.execute(
                    "SELECT 1 FROM subcategories WHERE id = ? AND user_id = ?",
                    (subcategory_id, user_id)
                ).fetchone()
                if subcheck:
                    return (category_id, subcategory_id)
        
        # Remove expired or invalid entry
        del _cache[full_key]
    
    return None


def cache_category_result(
    user_id: int,
    description_norm: str,
    amount: float,
    category_id: int,
    subcategory_id: int
) -> None:
    """
    Cache a categorization result for future reuse.
    """
    global _cache
    
    cache_key = _generate_cache_key(description_norm, amount)
    full_key = f"{user_id}:{cache_key}"
    
    # Cleanup old entries if cache is too large
    if len(_cache) >= MAX_CACHE_SIZE:
        # Remove oldest 20% of entries
        sorted_entries = sorted(
            _cache.items(),
            key=lambda x: x[1]["timestamp"]
        )
        entries_to_remove = len(sorted_entries) // 5
        for key_to_remove, _ in sorted_entries[:entries_to_remove]:
            del _cache[key_to_remove]
    
    _cache[full_key] = {
        "category_id": category_id,
        "subcategory_id": subcategory_id,
        "timestamp": time.time()
    }


def clear_user_cache(user_id: int) -> None:
    """Clear all cached categorizations for a user."""
    global _cache
    keys_to_remove = [k for k in _cache.keys() if k.startswith(f"{user_id}:")]
    for key in keys_to_remove:
        del _cache[key]


def get_cache_stats() -> Dict[str, Any]:
    """Return cache statistics."""
    now = time.time()
    total = len(_cache)
    expired = sum(1 for v in _cache.values() if now - v["timestamp"] >= CACHE_TTL)
    valid = total - expired
    
    return {
        "total_entries": total,
        "valid_entries": valid,
        "expired_entries": expired,
        "max_size": MAX_CACHE_SIZE,
        "ttl_seconds": CACHE_TTL
    }
