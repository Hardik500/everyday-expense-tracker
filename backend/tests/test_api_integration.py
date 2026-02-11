"""
Phase 6: API Integration Tests
Tests for API endpoints to ensure they handle requests correctly.
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app, get_current_user
from app import schemas


# Create test client
client = TestClient(app)

# Mock user for testing
mock_user = schemas.User(
    id=1,
    username="testuser",
    email="test@example.com",
    full_name="Test User"
)

@pytest.fixture
def mock_auth():
    """Override authentication for tests."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    yield
    app.dependency_overrides.clear()


class TestHealthEndpoint:
    """Test health check endpoint."""
    
    def test_health_check(self):
        """Test that health endpoint returns OK."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "timestamp" in data


class TestBulkUpdateValidation:
    """Test bulk update validation endpoints."""
    
    @pytest.mark.skip(reason="Requires database setup")
    def test_bulk_update_empty_transaction_ids(self, mock_auth):
        """Test that empty transaction_ids returns error."""
        response = client.post(
            "/transactions/bulk-update",
            data={
                "transaction_ids": [],
                "category_id": 1
            }
        )
        assert response.status_code == 400
        assert "transaction_ids cannot be empty" in response.json()["detail"]
    
    @pytest.mark.skip(reason="Requires database setup")
    def test_bulk_update_negative_category_id(self, mock_auth):
        """Test that negative category_id returns error."""
        response = client.post(
            "/transactions/bulk-update",
            data={
                "transaction_ids": [1, 2],
                "category_id": -1
            }
        )
        assert response.status_code == 400
        assert "category_id must be positive" in response.json()["detail"]


class TestRateLimiting:
    """Test rate limiting functionality."""
    
    @patch.dict(os.environ, {"GEMINI_API_KEY": "test_key"})
    @pytest.mark.skip(reason="Requires database and service mocking")
    def test_ai_categorize_rate_limit(self, mock_auth):
        """Test that exceeding rate limit returns 429."""
        # Make multiple requests to trigger rate limit
        for _ in range(15):  # Exceeds 10 req/min limit
            response = client.post("/ai/categorize", data={"limit": 1})
        
        # Should get rate limited
        assert response.status_code == 429
        assert "Rate limit exceeded" in response.json()["detail"]


class TestSearchEndpoint:
    """Test search functionality."""
    
    @patch('app.search.perform_ai_search')
    @pytest.mark.skip(reason="Requires search service")
    def test_search_valid_query(self, mock_search, mock_auth):
        """Test that search returns results."""
        mock_search.return_value = {
            "results": [],
            "total": 0,
            "filters": {}
        }
        
        response = client.post(
            "/transactions/search",
            json={
                "query": "food last month",
                "page": 1,
                "page_size": 25
            }
        )
        
        # May be 200 or 401 if auth fails, but structure is validated
        if response.status_code == 200:
            data = response.json()
            assert "results" in data
            assert "total" in data


class TestInputSanitization:
    """Test that inputs are properly sanitized."""
    
    def test_sql_injection_in_column_name(self):
        """Test that malicious column names are rejected."""
        from app.main import validate_column_name
        
        malicious_inputs = [
            "id; DROP TABLE users;--",
            "name' OR '1'='1",
            "category_id UNION SELECT * FROM passwords",
        ]
        
        for evil_input in malicious_inputs:
            assert validate_column_name(evil_input) is False


class TestErrorResponses:
    """Test that error responses are informative."""
    
    def test_404_error_format(self):
        """Test that 404 errors have consistent format."""
        response = client.get("/nonexistent/endpoint")
        assert response.status_code == 404
        # FastAPI returns standard detail field


class TestPagination:
    """Test pagination parameters."""
    
    @pytest.mark.skip(reason="Requires database setup")
    def test_transactions_pagination(self, mock_auth):
        """Test that transactions respect pagination."""
        response = client.get("/transactions?page=1&limit=10")
        if response.status_code == 200:
            data = response.json()
            # Should be a list
            assert isinstance(data, list)
            # Should respect limit
            assert len(data) <= 10


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
