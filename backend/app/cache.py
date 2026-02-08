"""
Caching decorator for FastAPI endpoints.
"""
import json
import hashlib
import logging
from functools import wraps
from typing import Callable, Any, Optional
from fastapi import Request
from app.redis_client import cache_get, cache_set, is_redis_available

logger = logging.getLogger(__name__)


def generate_cache_key(user_id: int, endpoint: str, **params) -> str:
    """
    Generate a deterministic cache key based on user ID, endpoint, and parameters.
    
    Args:
        user_id: User ID
        endpoint: Endpoint name (e.g., "reports:timeseries")
        **params: Query parameters to include in the key
    
    Returns:
        Cache key string
    """
    # Sort params for consistent key generation
    param_str = json.dumps(params, sort_keys=True)
    param_hash = hashlib.md5(param_str.encode()).hexdigest()[:8]
    
    return f"user:{user_id}:{endpoint}:{param_hash}"


def cached(ttl: int = 300, key_prefix: str = "reports"):
    """
    Decorator to cache endpoint responses in Redis.
    
    Args:
        ttl: Time-to-live in seconds (default: 5 minutes)
        key_prefix: Prefix for cache key (e.g., "reports", "dashboard")
    
    Usage:
        @cached(ttl=300, key_prefix="reports")
        async def my_endpoint(user_id: int, param1: str):
            # ... expensive operation
            return result
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Skip caching if Redis is unavailable
            if not is_redis_available():
                return await func(*args, **kwargs)
            
            # Extract user_id from kwargs (should be passed by dependency injection)
            user_id = kwargs.get('current_user')
            if user_id and hasattr(user_id, 'id'):
                user_id = user_id.id
            else:
                # If no user_id, skip caching
                logger.debug(f"No user_id found for {func.__name__}, skipping cache")
                return await func(*args, **kwargs)
            
            # Build cache key from function arguments
            cache_params = {}
            for key, value in kwargs.items():
                # Skip non-serializable objects (like current_user)
                if key == 'current_user':
                    continue
                # Convert to string for consistent hashing
                if value is not None:
                    cache_params[key] = str(value)
            
            cache_key = generate_cache_key(
                user_id=user_id,
                endpoint=f"{key_prefix}:{func.__name__}",
                **cache_params
            )
            
            # Try to get from cache
            cached_value = cache_get(cache_key)
            if cached_value:
                logger.debug(f"Cache HIT for {cache_key}")
                try:
                    return json.loads(cached_value)
                except json.JSONDecodeError:
                    logger.error(f"Failed to decode cached value for {cache_key}")
                    # Continue to fetch fresh data
            
            # Cache miss - execute function
            logger.debug(f"Cache MISS for {cache_key}")
            result = await func(*args, **kwargs)
            
            # Store in cache
            try:
                cache_value = json.dumps(result)
                cache_set(cache_key, cache_value, ttl=ttl)
                logger.debug(f"Cached result for {cache_key} (TTL: {ttl}s)")
            except (TypeError, json.JSONEncodeError) as e:
                logger.error(f"Failed to cache result for {cache_key}: {e}")
            
            return result
        
        return wrapper
    return decorator


def cache_key_for_endpoint(user_id: int, endpoint: str, **params) -> str:
    """
    Helper to generate cache key for manual invalidation.
    
    Usage:
        key = cache_key_for_endpoint(user_id=7, endpoint="reports:timeseries", start_date="2026-01-01")
        cache_delete(key)
    """
    return generate_cache_key(user_id, endpoint, **params)
