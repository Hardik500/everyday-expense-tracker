"""
Supabase Storage helper for uploading and retrieving statement files.

Uses the Supabase SDK to upload original bank statement attachments
to a 'statements' bucket and generate signed download URLs.
"""
import os
import logging
from typing import Optional
from datetime import datetime

logger = logging.getLogger(__name__)

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

BUCKET_NAME = "statements"

_client = None


def _get_client():
    """Lazily initialize the Supabase client."""
    global _client
    if _client is not None:
        return _client

    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        logger.warning(
            "Supabase Storage not configured: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing. "
            "File uploads will be skipped."
        )
        return None

    try:
        from supabase import create_client
        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

        # Ensure bucket exists (idempotent)
        try:
            _client.storage.get_bucket(BUCKET_NAME)
        except Exception:
            try:
                _client.storage.create_bucket(
                    BUCKET_NAME,
                    options={"public": False, "file_size_limit": 10 * 1024 * 1024}
                )
                logger.info(f"Created Supabase Storage bucket: {BUCKET_NAME}")
            except Exception as bucket_err:
                logger.warning(f"Could not create bucket '{BUCKET_NAME}': {bucket_err}")

        return _client
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")
        return None


def upload_statement(user_id: int, filename: str, data: bytes) -> Optional[str]:
    """
    Upload a statement file to Supabase Storage.

    Args:
        user_id: The owner's user ID.
        filename: Original filename (e.g., 'HDFC_March_2025.pdf').
        data: Raw file bytes.

    Returns:
        The storage path string if successful, None otherwise.
    """
    client = _get_client()
    if client is None:
        return None

    # Build a unique path: statements/<user_id>/<timestamp>_<filename>
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    # Sanitize filename
    safe_filename = "".join(c for c in filename if c.isalnum() or c in "._-").strip()
    if not safe_filename:
        safe_filename = "statement"
    storage_path = f"{user_id}/{timestamp}_{safe_filename}"

    try:
        # Determine content type
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        content_type_map = {
            "pdf": "application/pdf",
            "csv": "text/csv",
            "xls": "application/vnd.ms-excel",
            "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "ofx": "application/x-ofx",
            "qfx": "application/x-ofx",
            "txt": "text/plain",
        }
        content_type = content_type_map.get(ext, "application/octet-stream")

        client.storage.from_(BUCKET_NAME).upload(
            path=storage_path,
            file=data,
            file_options={"content-type": content_type}
        )
        logger.info(f"Uploaded statement to storage: {storage_path}")
        return storage_path
    except Exception as e:
        logger.error(f"Failed to upload statement to storage: {e}")
        return None


def get_download_url(storage_path: str, expires_in: int = 3600) -> Optional[str]:
    """
    Generate a signed download URL for a stored statement file.

    Args:
        storage_path: The path returned by upload_statement().
        expires_in: URL expiry time in seconds (default 1 hour).

    Returns:
        A signed URL string if successful, None otherwise.
    """
    client = _get_client()
    if client is None or not storage_path:
        return None

    try:
        result = client.storage.from_(BUCKET_NAME).create_signed_url(
            path=storage_path,
            expires_in=expires_in
        )
        if result and "signedURL" in result:
            return result["signedURL"]
        # Some SDK versions return differently
        if isinstance(result, dict) and "signedUrl" in result:
            return result["signedUrl"]
        return str(result) if result else None
    except Exception as e:
        logger.error(f"Failed to generate download URL for {storage_path}: {e}")
        return None
