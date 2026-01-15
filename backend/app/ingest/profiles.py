from typing import Dict, Optional


PROFILE_DEFINITIONS: Dict[str, Dict[str, str]] = {
    "generic": {
        "date": "date",
        "description": "description",
        "amount": "amount",
        "currency": "currency",
        "debit": "debit",
        "credit": "credit",
    }
}


def resolve_profile(profile: Optional[str]) -> Dict[str, str]:
    if not profile:
        return PROFILE_DEFINITIONS["generic"]
    if profile not in PROFILE_DEFINITIONS:
        raise ValueError(f"Unknown profile: {profile}")
    return PROFILE_DEFINITIONS[profile]
