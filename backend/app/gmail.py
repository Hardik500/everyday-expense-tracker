import os
import json
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials

# Scopes required for Gmail access
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

# OAuth2 Configuration from environment
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
# This must match one of the redirect URIs in Google Cloud Console
REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "https://everydayexpensetracker.online/auth/google/callback")

def get_flow():
    """Build the OAuth2 flow object."""
    client_config = {
        "web": {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [REDIRECT_URI]
        }
    }
    return Flow.from_client_config(
        client_config,
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI
    )

def get_authorization_url():
    """Generate the authorization URL for the user."""
    flow = get_flow()
    # prompt='consent' ensures we get a refresh token
    auth_url, _ = flow.authorization_url(access_type='offline', prompt='consent')
    return auth_url

def get_refresh_token(code):
    """Exchange authorization code for a refresh token."""
    flow = get_flow()
    flow.fetch_token(code=code)
    credentials = flow.credentials
    return credentials.refresh_token

def get_gmail_service(refresh_token):
    """Build a Gmail service object using a refresh token."""
    creds = Credentials(
        None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
    )
    
    # Check if credentials need refreshing
    if not creds.valid:
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
            
    return build('gmail', 'v1', credentials=creds)

def sync_user_gmail(user_id, refresh_token, query):
    """Placeholder for the actual sync logic (to be implemented in worker.py)."""
    # This will be called by the background worker
    pass
