"""
Redis client for caching with connection pooling and graceful fallback.
"""
import os
import logging
from typing import Optional
from redis import Redis, ConnectionPool, RedisError
from redis.connection import ConnectionPool as RedisConnectionPool

logger = logging.getLogger(__name__)

# Global Redis client instance
_redis_client: Optional[Redis] = None
_redis_available = False


def get_redis_client() -> Optional[Redis]:
    """
    Get or create the Redis client singleton.
    Returns None if Redis is unavailable (graceful degradation).
    """
    global _redis_client, _redis_available
    
    if _redis_client is not None:
        return _redis_client
    
    # Check if Redis is configured
    redis_url = os.getenv("REDIS_URL")
    redis_host = os.getenv("REDIS_HOST")
    redis_port = os.getenv("REDIS_PORT", "6379")
    redis_password = os.getenv("REDIS_PASSWORD")

    
    if not redis_url and not redis_host:
        logger.warning("Redis not configured. Caching will be disabled.")
        _redis_available = False
        return None
    
    try:
        if redis_url:
            # Use connection URL (Railway format)
            pool = ConnectionPool.from_url(
                redis_url,
                decode_responses=True,
                max_connections=10,
                socket_connect_timeout=5,
                socket_timeout=5,
            )
        else:
            # Use individual connection parameters
            pool = ConnectionPool(
                host=redis_host,
                port=int(redis_port),
                password=redis_password,
                decode_responses=True,
                max_connections=10,
                socket_connect_timeout=5,
                socket_timeout=5,
            )
        
        _redis_client = Redis(connection_pool=pool)
        
        # Test connection
        _redis_client.ping()
        _redis_available = True
        logger.info("Redis connection established successfully")
        
        return _redis_client
        
    except RedisError as e:
        logger.error(f"Failed to connect to Redis: {e}")
        logger.warning("Caching will be disabled. Application will continue without cache.")
        _redis_available = False
        _redis_client = None
        return None
    except Exception as e:
        logger.error(f"Unexpected error connecting to Redis: {e}")
        _redis_available = False
        _redis_client = None
        return None


def is_redis_available() -> bool:
    """Check if Redis is available."""
    return _redis_available


def cache_get(key: str) -> Optional[str]:
    """
    Get value from cache.
    Returns None if key doesn't exist or Redis is unavailable.
    """
    client = get_redis_client()
    if not client:
        return None
    
    try:
        return client.get(key)
    except RedisError as e:
        logger.error(f"Redis GET error for key {key}: {e}")
        return None


def cache_set(key: str, value: str, ttl: int = 300) -> bool:
    """
    Set value in cache with TTL (time-to-live) in seconds.
    Returns True if successful, False otherwise.
    """
    client = get_redis_client()
    if not client:
        return False
    
    try:
        client.setex(key, ttl, value)
        return True
    except RedisError as e:
        logger.error(f"Redis SET error for key {key}: {e}")
        return False


def cache_delete(key: str) -> bool:
    """
    Delete a key from cache.
    Returns True if successful, False otherwise.
    """
    client = get_redis_client()
    if not client:
        return False
    
    try:
        client.delete(key)
        return True
    except RedisError as e:
        logger.error(f"Redis DELETE error for key {key}: {e}")
        return False


def cache_delete_pattern(pattern: str) -> int:
    """
    Delete all keys matching a pattern.
    Returns number of keys deleted, or 0 if Redis is unavailable.
    """
    client = get_redis_client()
    if not client:
        return 0
    
    try:
        keys = client.keys(pattern)
        if keys:
            return client.delete(*keys)
        return 0
    except RedisError as e:
        logger.error(f"Redis DELETE PATTERN error for pattern {pattern}: {e}")
        return 0


def invalidate_user_cache(user_id: int, cache_type: str = "*") -> int:
    """
    Invalidate all cache entries for a specific user.
    
    Args:
        user_id: User ID
        cache_type: Cache type pattern (e.g., "reports", "dashboard", "*" for all)
    
    Returns:
        Number of keys deleted
    """
    pattern = f"user:{user_id}:{cache_type}:*"
    deleted = cache_delete_pattern(pattern)
    if deleted > 0:
        logger.info(f"Invalidated {deleted} cache entries for user {user_id} (type: {cache_type})")
    return deleted
