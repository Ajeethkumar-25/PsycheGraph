from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
import os
import uuid
from datetime import datetime

SCOPES = ['https://www.googleapis.com/auth/calendar']

if os.name == "windows":
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    TOKEN_PATH = os.path.join(BASE_DIR, "token.json")
    CREDENTIALS_PATH = os.path.join(BASE_DIR, "credentials.json")
elif os.name == "linux":
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    TOKEN_PATH = os.path.join(BASE_DIR, "token.json")
    CREDENTIALS_PATH = os.path.join(BASE_DIR, "credentials.json")
else:
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    TOKEN_PATH = os.path.join(BASE_DIR, "token.json")
    CREDENTIALS_PATH = os.path.join(BASE_DIR, "credentials.json")

# ← Cache the service globally so build() is only called once
_cached_service = None

class GoogleCalendarService:
    def __init__(self):
        self.service = self._get_service()

    def _get_service(self):
        global _cached_service

        # Return cached service if available
        if _cached_service is not None:
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

        # ← cache=discovery_url avoids HTTP call on every build()
        _cached_service = build(
            'calendar', 'v3',
            credentials=creds,
            cache_discovery=False   # ← prevents file cache warnings on server
        )
        return _cached_service

    def create_event(self, summary: str, start_time: datetime, end_time: datetime, attendee_email: str = None):
        try:
            # ← Refresh credentials if expired before each event creation
            creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)
            if creds.expired and creds.refresh_token:
                creds.refresh(Request())
                with open(TOKEN_PATH, 'w') as token:
                    token.write(creds.to_json())
                # rebuild service with fresh creds
                global _cached_service
                _cached_service = build(
                    'calendar', 'v3',
                    credentials=creds,
                    cache_discovery=False
                )
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