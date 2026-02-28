from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
import os
import uuid
from datetime import datetime

SCOPES = ['https://www.googleapis.com/auth/calendar']

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TOKEN_PATH = os.path.join(BASE_DIR, "token.json")
CREDENTIALS_PATH = os.path.join(BASE_DIR, "credentials.json")

# Cache both the service AND the credentials object in memory.
# Before the fix, create_event() re-read token.json from disk on every call,
# plus potentially made an HTTP refresh request. Now we only re-read when creds expire.
_cached_service = None
_cached_creds = None   # FIX: cache credentials object, not just the service


class GoogleCalendarService:
    def __init__(self):
        self.service = self._get_service()

    def _get_service(self):
        global _cached_service, _cached_creds

        # Return cached service if credentials are still valid
        if _cached_service is not None and _cached_creds is not None and _cached_creds.valid:
            return _cached_service

        creds = None
        if os.path.exists(TOKEN_PATH):
            creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)

        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
            with open(TOKEN_PATH, 'w') as token:
                token.write(creds.to_json())

        if not creds or not creds.valid:
            raise Exception("Google Calendar credentials invalid. Run generate_token.py again.")

        _cached_creds = creds
        _cached_service = build(
            'calendar', 'v3',
            credentials=creds,
            cache_discovery=False
        )
        return _cached_service

    def _refresh_if_needed(self):
        """
        FIX: Check in-memory cached credentials for expiry instead of
        re-reading token.json from disk on every create_event() call.
        Only reads disk / makes HTTP call when actually expired.
        """
        global _cached_service, _cached_creds

        if _cached_creds is None or not _cached_creds.valid:
            if _cached_creds and _cached_creds.expired and _cached_creds.refresh_token:
                _cached_creds.refresh(Request())
                with open(TOKEN_PATH, 'w') as token:
                    token.write(_cached_creds.to_json())
                # Rebuild service with fresh creds
                _cached_service = build(
                    'calendar', 'v3',
                    credentials=_cached_creds,
                    cache_discovery=False
                )
                self.service = _cached_service

    def create_event(self, summary: str, start_time: datetime, end_time: datetime, attendee_email: str = None):
        try:
            # FIX: Use in-memory credential check instead of reading token.json every call
            self._refresh_if_needed()

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

            result = self.service.events().insert(
                calendarId='primary',
                body=event,
                conferenceDataVersion=1,
                sendUpdates='all' if attendee_email else 'none'
            ).execute()

            meet_link = result.get('hangoutLink')
            return meet_link

        except Exception as e:
            print(f"[GOOGLE CALENDAR ERROR] {e}")
            return None