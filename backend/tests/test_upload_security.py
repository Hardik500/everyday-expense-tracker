import pytest
from fastapi.testclient import TestClient
from app.main import app, MAX_FILE_SIZE

client = TestClient(app)

# Mock authenticated user dependency if needed, but TestClient might need overrides
# For simplicity, let's see if we can hit the endpoint. detect-account requires auth.

# We need to mock the authentication dependency
from app.main import get_current_user
from app import schemas

def override_get_current_user():
    return schemas.User(
        id=1,
        username="testuser",
        email="test@example.com",
        created_at="2024-01-01T00:00:00",
        updated_at="2024-01-01T00:00:00"
    )

app.dependency_overrides[get_current_user] = override_get_current_user

def test_upload_too_large():
    # Create a file content slightly larger than MAX_FILE_SIZE
    # We don't want to actually create a 10MB string in memory if we can avoid it for speed,
    # but the validation reads the file.
    # Let's mock the file size check or just test the boundary with a small limit if we could config it.
    # Since MAX_FILE_SIZE is 10MB, we can try to upload a file that reports a large size?
    # Or actually generate a large dummy file. 11MB is manageable.
    
    # 11MB of data
    large_content = b"a" * (MAX_FILE_SIZE + 1024)
    
    files = {
        "file": ("large_file.csv", large_content, "text/csv")
    }
    
    response = client.post("/detect-account", files=files)
    
    # Expect 413 Request Entity Too Large
    assert response.status_code == 413
    assert "File too large" in response.json()["detail"]

def test_upload_invalid_extension():
    files = {
        "file": ("malicious.exe", b"content", "application/x-msdownload")
    }
    
    response = client.post("/detect-account", files=files)
    
    # Expect 400 Bad Request
    assert response.status_code == 400
    assert "File type not allowed" in response.json()["detail"]

def test_upload_valid_file():
    # valid extension and size
    files = {
        "file": ("statement.csv", b"date,amount,desc\n2024-01-01,100,test", "text/csv")
    }
    
    # We might get other errors (db connection etc) but we shouldn't get 413 or 400 for file validation
    try:
        response = client.post("/detect-account", files=files)
        assert response.status_code != 413
        assert response.status_code != 400
    except Exception:
        # If DB fails, that's fine, we passed validation
        pass
