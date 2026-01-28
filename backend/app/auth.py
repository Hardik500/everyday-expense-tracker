import os
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt, jwk
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from . import schemas
from .db import get_conn

# Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-super-secret-key-change-it-in-production")
ALGORITHM = "HS256"

import httpx
import time

# Supabase Auth Configuration
# This MUST be the "JWT Secret" from Supabase Dashboard -> Settings -> API
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", SECRET_KEY)

# JWKS Cache
jwks_cache = {}
jwks_last_fetch = 0

async def get_supabase_jwks():
    global jwks_cache, jwks_last_fetch
    # Cache for 1 hour
    if time.time() - jwks_last_fetch < 3600 and jwks_cache:
        return jwks_cache
    
    try:
        # We try to get the project URL from env to construct JWKS URL
        supabase_url = os.getenv("SUPABASE_URL")
        if not supabase_url:
            # Fallback: find it from the token issuer later if needed
            return None
            
        jwks_url = f"{supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
        async with httpx.AsyncClient() as client:
            resp = await client.get(jwks_url)
            if resp.status_code == 200:
                jwks_cache = resp.json()
                jwks_last_fetch = time.time()
                return jwks_cache
    except Exception as e:
        print(f"Error fetching JWKS: {e}")
    return None

# Log configuration on startup (without secrets)
print(f"Auth initialized with SUPABASE_JWT_SECRET len: {len(SUPABASE_JWT_SECRET)}")

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
        print("No token provided")
        raise credentials_exception

    try:
        # Debug: Log the unverified header to see what algorithm is being used
        header = jwt.get_unverified_header(token)
        alg = header.get("alg")

        if alg in ["ES256", "RS256"]:
            # Asymmetric verification using JWKS
            project_url = os.getenv("SUPABASE_URL")
            if project_url:
                jwks = await get_supabase_jwks()
                if jwks:
                    # Find the specific key used to sign this token
                    kid = header.get("kid")
                    key_data = next((k for k in jwks.get('keys', []) if k.get('kid') == kid), None)
                    if not key_data:
                        print(f"Key with kid {kid} not found in JWKS, trying first key")
                        key_data = jwks['keys'][0] if jwks.get('keys') else None
                    
                    if key_data:
                        # Construct a public key object from JWKS data
                        public_key = jwk.construct(key_data)
                        payload = jwt.decode(
                            token, 
                            public_key, 
                            algorithms=[alg], 
                            options={"verify_aud": False}
                        )
                    else:
                        print("JWKS is empty or missing 'keys'")
                        raise credentials_exception
                else:
                    print("Could not fetch JWKS from Supabase URL")
                    raise credentials_exception
            else:
                print("SUPABASE_URL not set in environment variables")
                raise credentials_exception
        else:
            # Symmetric verification (HS256)
            payload = jwt.decode(
                token, 
                SUPABASE_JWT_SECRET, 
                algorithms=["HS256"], 
                options={"verify_aud": False}
            )
            
        user_uuid: str = payload.get("sub")
        email: str = payload.get("email")
        if user_uuid is None:
            print("Token sub claim missing")
            raise credentials_exception
    except Exception as e:
        print(f"JWT Verification Error: {str(e)}")
        # Fallback to local SECRET_KEY if different (legacy)
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
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
