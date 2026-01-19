import os
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from . import schemas
from .db import get_conn

# Supabase Auth Configuration
# If SECRET_KEY is the Supabase JWT Secret, this works.
# In production, this should be set to the value from the Supabase Dashboard -> Settings -> API.
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", SECRET_KEY)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)

def verify_password(plain_password, hashed_password):
    if not hashed_password: # Support passwordless users
        return False
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    # This remains for local development/legacy support if needed
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_db():
    with get_conn() as conn:
        yield conn

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception

    try:
        # Try decoding with Supabase/Local secret
        # Supabase uses custom claims, 'sub' is the user UUID
        payload = jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=[ALGORITHM], options={"verify_aud": False})
        user_uuid: str = payload.get("sub")
        email: str = payload.get("email")
        if user_uuid is None:
            raise credentials_exception
    except JWTError:
        # Fallback to local SECRET_KEY if different
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            username: str = payload.get("sub")
            if username is None:
                raise credentials_exception
            
            with get_conn() as conn:
                user_row = conn.execute("SELECT * FROM users WHERE LOWER(username) = LOWER(?)", (username,)).fetchone()
                if user_row:
                    return schemas.User(**dict(user_row))
        except JWTError:
            raise credentials_exception

    # Supabase user handling
    with get_conn() as conn:
        # 1. Lookup by Supabase UID
        user_row = conn.execute("SELECT * FROM users WHERE supabase_uid = ?", (user_uuid,)).fetchone()
        
        if not user_row and email:
            # 2. Lookup by email to link existing user (Migration Case)
            user_row = conn.execute("SELECT * FROM users WHERE LOWER(email) = LOWER(?)", (email,)).fetchone()
            if user_row:
                # Link this user
                conn.execute("UPDATE users SET supabase_uid = ? WHERE id = ?", (user_uuid, user_row["id"]))
                conn.commit()
                # Refetch linked user
                user_row = conn.execute("SELECT * FROM users WHERE id = ?", (user_row["id"],)).fetchone()
        
        if not user_row:
            # 3. Auto-create user if it doesn't exist at all (New Supabase User)
            username_suggestion = email.split("@")[0] if email else f"user_{user_uuid[:8]}"
            try:
                cursor = conn.execute(
                    "INSERT INTO users (username, email, supabase_uid) VALUES (?, ?, ?)",
                    (username_suggestion, email, user_uuid)
                )
                conn.commit()
                user_row = conn.execute("SELECT * FROM users WHERE id = ?", (cursor.lastrowid,)).fetchone()
            except Exception as e:
                # Handle unique constraint collision on username
                username_suggestion = f"{username_suggestion}_{user_uuid[:4]}"
                cursor = conn.execute(
                    "INSERT INTO users (username, email, supabase_uid) VALUES (?, ?, ?)",
                    (username_suggestion, email, user_uuid)
                )
                conn.commit()
                user_row = conn.execute("SELECT * FROM users WHERE id = ?", (cursor.lastrowid,)).fetchone()

    if user_row is None:
        raise credentials_exception
    return schemas.User(**dict(user_row))
