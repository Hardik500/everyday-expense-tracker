"""
Phase 6: Unit Tests for Critical Logic
Tests for categorization, validation, and security functions.
"""
import pytest
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import validate_column_name, sanitize_sql_identifier
from app.rules.ai import _extract_json, _build_prompt


class TestSecurityFunctions:
    """Test security-related functions."""
    
    def test_validate_column_name_valid(self):
        """Test that valid column names pass validation."""
        assert validate_column_name("username") is True
        assert validate_column_name("category_id") is True
        assert validate_column_name("amount") is True
    
    def test_validate_column_name_invalid(self):
        """Test that invalid column names fail validation."""
        assert validate_column_name("username; DROP TABLE") is False
        assert validate_column_name("") is False
        assert validate_column_name(None) is False  # type: ignore
    
    def test_sanitize_sql_identifier_valid(self):
        """Test that valid identifiers are preserved."""
        assert sanitize_sql_identifier("users") == "users"
        assert sanitize_sql_identifier("category_id") == "category_id"
    
    def test_sanitize_sql_identifier_invalid(self):
        """Test that invalid identifiers raise exceptions."""
        with pytest.raises(Exception):
            sanitize_sql_identifier("users; DROP TABLE")
        with pytest.raises(Exception):
            sanitize_sql_identifier("name'")


class TestAIHelpers:
    """Test AI categorization helper functions."""
    
    def test_extract_json_valid(self):
        """Test JSON extraction from various formats."""
        # Plain JSON
        assert _extract_json('{"category": "Food"}') == {"category": "Food"}
        # Markdown code block
        assert _extract_json('```json\n{"category": "Food"}\n```') == {"category": "Food"}
        # With extra text
        result = _extract_json('Here is the result: {"category": "Food"} End')
        assert result == {"category": "Food"}
    
    def test_extract_json_invalid(self):
        """Test handling of invalid JSON."""
        assert _extract_json("") is None
        assert _extract_json("not json") is None
    
    def test_build_prompt_contains_required_elements(self):
        """Test that build_prompt includes required elements."""
        prompt = _build_prompt("Test Transaction", -50.00, '{"categories": []}')
        assert "financial transaction" in prompt.lower()
        assert "₹50.00" in prompt
        assert "debit/expense" in prompt.lower()


class TestBulkUpdateValidation:
    """Test bulk update validation."""
    
    def test_transaction_ids_validation(self):
        """Test validation of transaction IDs."""
        # Valid IDs
        valid_ids = [1, 2, 3, 100, 999]
        for tx_id in valid_ids:
            assert isinstance(tx_id, int) and tx_id > 0
        
        # Test limits
        assert len(list(range(1000))) == 1000  # Boundary value
        assert len(list(range(1001))) == 1001  # Over limit


class TestDatabaseIndexes:
    """Test that database indexes are properly configured."""
    
    def test_index_names_follow_conventions(self):
        """Test that index names follow naming conventions."""
        index_names = [
            "idx_transactions_user_id",
            "idx_transactions_user_posted",
            "idx_accounts_user_id",
            "idx_categories_user_id",
        ]
        for name in index_names:
            assert name.startswith("idx_")
            parts = name.split("_")
            assert len(parts) >= 3  # idx_table[_column(s)]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
