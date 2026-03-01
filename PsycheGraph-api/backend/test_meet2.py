from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from dotenv import load_dotenv
import httplib2
import os
import uuid
import logging
from datetime import datetime
from pathlib import Path

logger = logging.getLogger("google_calendar")

SCOPES = ['https://www.googleapis.com/auth/calendar']

_base_dir = Path(__file__).resolve().parent.parent.parent
load_dotenv(_base_dir / ".env")

TOKEN_PATH = os.getenv("GOOGLE_TOKEN_PATH") or str(_base_dir / "token.json")
CREDENTIALS_PATH = os.getenv("GOOGLE_CREDENTIALS_PATH") or str(_base_dir / "credentials.json")

logger.info(f"[GOOGLE CALENDAR] TOKEN_PATH      = {TOKEN_PATH}")
logger.info(f"[GOOGLE CALENDAR] CREDENTIALS_PATH= {CREDENTIALS_PATH}")
logger.info(f"[GOOGLE CALENDAR] token.json exists: {os.path.exists(TOKEN_PATH)}")
logger.info(f"[GOOGLE CALENDAR] credentials.json exists: {os.path.exists(CREDENTIALS_PATH)}")

_cached_service = None

# Timeout in seconds for all Google API HTTP calls
API_TIMEOUT = 30


def _load_and_refresh_creds() -> Credentials | None:
    if not os.path.exists(TOKEN_PATH):
        logger.error(
            f"[GOOGLE CALENDAR] token.json not found at: {TOKEN_PATH}\n"
            f"  Fix: copy token.json to that path on the server, or set "
            f"GOOGLE_TOKEN_PATH in your .env to the correct absolute path."
        )
        return None

    try:
        creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)
    except Exception as e:
        logger.error(f"[GOOGLE CALENDAR] Failed to read token.json: {e}")
        return None

    if creds.valid:
        return creds

    if creds.expired and creds.refresh_token:
        logger.info("[GOOGLE CALENDAR] Token expired — attempting refresh...")
        try:
            creds.refresh(Request())
            with open(TOKEN_PATH, 'w') as f:
                f.write(creds.to_json())
            logger.info("[GOOGLE CALENDAR] Token refreshed and saved successfully.")
            return creds
        except Exception as e:
            logger.error(
                f"[GOOGLE CALENDAR] Token refresh failed: {e}\n"
                f"  This usually means:\n"
                f"  1. The refresh token was revoked (re-run generate_token.py on the server)\n"
                f"  2. Google blocked the refresh from this server IP\n"
                f"  3. The OAuth app is in test mode and token expired after 7 days\n"
                f"     Fix: go to Google Cloud Console → OAuth consent screen → publish the app"
            )
            return None

    logger.error(
        f"[GOOGLE CALENDAR] Credentials invalid and cannot be refreshed.\n"
        f"  creds.valid={creds.valid}, creds.expired={creds.expired}, "
        f"  has_refresh_token={bool(creds.refresh_token)}\n"
        f"  Fix: re-run generate_token.py directly on the EC2 server."
    )
    return None


def _build_service(creds: Credentials):
    # Use httplib2 with explicit timeout so calls never hang indefinitely
    http = creds.authorize(httplib2.Http(timeout=API_TIMEOUT))
    return build('calendar', 'v3', http=http, cache_discovery=False)


class GoogleCalendarService:
    def __init__(self):
        self.service = self._get_service()

    def _get_service(self):
        global _cached_service
        if _cached_service is not None:
            return _cached_service

        creds = _load_and_refresh_creds()
        if not creds:
            return None

        _cached_service = _build_service(creds)
        logger.info("[GOOGLE CALENDAR] Service initialized and cached.")
        return _cached_service

    def create_event(
        self,
        summary: str,
        start_time: datetime,
        end_time: datetime,
        attendee_email: str = None
    ):
        global _cached_service

        creds = _load_and_refresh_creds()
        if not creds:
            logger.error("[GOOGLE CALENDAR] Cannot create event — credentials unavailable.")
            return None

        # Rebuild service with fresh creds + timeout
        _cached_service = _build_service(creds)
        self.service = _cached_service

        event = {
            'summary': summary,
            'start': {
                'dateTime': start_time.isoformat(),
                'timeZone': 'UTC',
            },
            'end': {
                'dateTime': end_time.isoformat(),
                'timeZone': 'UTC',
            },
            'conferenceData': {
                'createRequest': {
                    'requestId': str(uuid.uuid4()),
                    'conferenceSolutionKey': {'type': 'hangoutsMeet'}
                }
            }
        }

        if attendee_email:
            event['attendees'] = [{'email': attendee_email}]

        try:
            result = self.service.events().insert(
                calendarId='primary',
                body=event,
                conferenceDataVersion=1,
                sendUpdates='all' if attendee_email else 'none'
            ).execute()

            meet_link = result.get('hangoutLink')
            if meet_link:
                logger.info(f"[GOOGLE CALENDAR] Meet link created: {meet_link}")
            else:
                logger.warning("[GOOGLE CALENDAR] Event created but no hangoutLink returned.")
            return meet_link

        except Exception as e:
            logger.error(f"[GOOGLE CALENDAR] Event creation failed: {e}")
            return None