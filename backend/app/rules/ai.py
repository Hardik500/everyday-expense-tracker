import os
from typing import Optional, Tuple


def ai_classify(description_norm: str, amount: float) -> Optional[Tuple[int, int]]:
    """
    Placeholder for optional AI-assisted categorization.
    Returns (category_id, subcategory_id) or None if disabled.
    """
    provider = os.getenv("AI_PROVIDER")
    if not provider:
        return None
    # Intentionally no-op for now; wire when an AI provider is configured.
    return None
