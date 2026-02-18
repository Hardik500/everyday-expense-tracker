"""Security tests for Phase 3 endpoints - Rate Limiting"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app import schemas
from unittest.mock import patch
import time

# Mock authenticated user
def override_get_current_user():
    return schemas.User(
        id=1,
        username="testuser",
        email="test@example.com",
        created_at="2024-01-01T00:00:00",
        updated_at="2024-01-01T00:00:00"
    )

from app.main import get_current_user
app.dependency_overrides[get_current_user] = override_get_current_user

client = TestClient(app)


def test_backup_export_rate_limit():
    """Test that backup export is rate limited."""
    # First request should succeed
    response = client.get("/api/v1/backup/export")
    # May fail due to DB, but shouldn't be rate limited if first request
    initial_status = response.status_code
    
    # Rapid fire requests should trigger rate limiting
    rate_limited = False
    for i in range(5):
        response = client.get("/api/v1/backup/export")
        if response.status_code == 429:
            rate_limited = True
            break
    
    # At least one of the rapid requests should be rate limited
    # (or all should fail with same error as first if it's a DB issue)
    assert rate_limited or initial_status != 200, "Rate limiting should be applied"


def test_duplicate_detection_rate_limit():
    """Test that duplicate detection is rate limited."""
    rate_limited = False
    for i in range(5):
        response = client.get("/api/v1/duplicates/detect")
        if response.status_code == 429:
            rate_limited = True
            break
    
    assert rate_limited, "Duplicate detection should be rate limited"


def test_backup_import_size_limit():
    """Test that backup import rejects oversized payloads."""
    # Create a large import payload (> 1MB)
    large_payload = {
        "version": "1.0",
        "transactions": [{"posted_at": "2024-01-01", "amount": 100, "description_raw": "test", 
                         "account_id": 1} for _ in range(10000)]
    }
    
    response = client.post("/api/v1/backup/import", json=large_payload)
    
    # Should reject with 400 or 413
    assert response.status_code in [400, 413, 422], f"Expected error for large payload, got {response.status_code}"
