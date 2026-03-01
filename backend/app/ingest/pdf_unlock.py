import io
import pikepdf
from typing import List

def _get_user_passwords(conn, user_id: int) -> List[str]:
    rows = conn.execute(
        "SELECT value FROM pdf_passwords WHERE user_id = ?", 
        (user_id,)
    ).fetchall()
    return [r["value"] for r in rows]

def _generate_password_variants(base_passwords: List[str]) -> List[str]:
    """Generate common variations of passwords (e.g. upper/lower, date formats)."""
    variants = set()
    for pwd in base_passwords:
        variants.add(pwd)
        variants.add(pwd.upper())
        variants.add(pwd.lower())
        
        # If it looks like DDMMYYYY, generate DD-MM-YYYY and DDMMYY
        if len(pwd) == 8 and pwd.isdigit():
            d, m, y = pwd[:2], pwd[2:4], pwd[4:]
            variants.add(f"{d}-{m}-{y}")
            variants.add(f"{d}{m}{y[-2:]}")
            
        # If it looks like DD-MM-YYYY, generate DDMMYYYY, DDMMYY
        if len(pwd) == 10 and pwd[2] == '-' and pwd[5] == '-':
            d, m, y = pwd[:2], pwd[3:5], pwd[6:]
            if d.isdigit() and m.isdigit() and y.isdigit():
                variants.add(f"{d}{m}{y}")
                variants.add(f"{d}{m}{y[-2:]}")
            
    return list(variants)

def try_unlock_pdf(conn, payload: bytes, user_id: int, extra_passwords: List[str] = None) -> bytes:
    """
    Attempt to unlock an encrypted PDF with user's stored passwords and extra ones from context.
    Returns the unlocked bytes if successful or if not encrypted.
    Raises ValueError if unlocking fails.
    """
    try:
        # Check if it's actually encrypted by trying to open without a password
        with pikepdf.Pdf.open(io.BytesIO(payload)) as pdf:
            return payload
    except pikepdf.PasswordError:
        # Encrypted, proceed to unlock
        pass
    except Exception:
        # Not a valid PDF or other error, return original payload and let existing parsers handle/fail
        return payload

    user_passwords = _get_user_passwords(conn, user_id)
    if extra_passwords:
        user_passwords.extend(extra_passwords)
    
    variants = _generate_password_variants(user_passwords)
    
    for pwd in variants:
        try:
            with pikepdf.Pdf.open(io.BytesIO(payload), password=pwd) as pdf:
                # Successfully unlocked! 
                out = io.BytesIO()
                pdf.save(out)
                return out.getvalue()
        except pikepdf.PasswordError:
            continue
        except Exception:
            continue
            
    raise ValueError("PDF is encrypted and no valid password was found")
