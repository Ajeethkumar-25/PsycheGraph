import os
import datetime
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Google Calendar scope
SCOPES = ["https://www.googleapis.com/auth/calendar"]

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CREDENTIALS_PATH = os.path.join(BASE_DIR, "credentials.json")
TOKEN_PATH = os.path.join(BASE_DIR, "token.json")


class GoogleCalendarService:
    def __init__(self):
        self.creds = None
        self.service = None
        self._authenticate()

    def _authenticate(self):
        """Authenticate with Google Calendar API"""

        # Load existing token
        if os.path.exists(TOKEN_PATH):
            self.creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)

        # Refresh token if expired
        if self.creds and self.creds.expired and self.creds.refresh_token:
            try:
                self.creds.refresh(Request())
            except Exception:
                self.creds = None

        # If no valid credentials → login
        if not self.creds or not self.creds.valid:
            if not os.path.exists(CREDENTIALS_PATH):
                print("ERROR: credentials.json not found")
                return

            flow = InstalledAppFlow.from_client_secrets_file(
                CREDENTIALS_PATH,
                SCOPES
            )

            print("Login required for Google Calendar...")
            self.creds = flow.run_local_server(port=0)

            # Save token
            with open(TOKEN_PATH, "w") as token:
                token.write(self.creds.to_json())

        # Build service
        try:
            self.service = build(
                "calendar",
                "v3",
                credentials=self.creds
            )
            print("Google Calendar connected successfully")
        except Exception as e:
            print("Calendar build error:", e)

    def create_event(
        self,
        summary: str,
        start_time: datetime.datetime,
        end_time: datetime.datetime,
        attendee_email: str | None = None,
    ) -> str | None:
        """
        Create Google Calendar event with Meet link
        """

        if not self.service:
            print("Calendar service not initialized")
            return None

        # Ensure UTC timezone
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=datetime.timezone.utc)

        if end_time.tzinfo is None:
            end_time = end_time.replace(tzinfo=datetime.timezone.utc)

        event_body = {
            "summary": summary,
            "description": "Appointment via PsycheGraph",
            "start": {
                "dateTime": start_time.isoformat(),
                "timeZone": "UTC",
            },
            "end": {
                "dateTime": end_time.isoformat(),
                "timeZone": "UTC",
            },
            "conferenceData": {
                "createRequest": {
                    "requestId": f"psychegraph-{int(start_time.timestamp())}",
                    "conferenceSolutionKey": {
                        "type": "hangoutsMeet"
                    },
                }
            },
        }

        # Add attendee if exists
        if attendee_email:
            event_body["attendees"] = [{"email": attendee_email}]

        try:
            event = (
                self.service.events()
                .insert(
                    calendarId="primary",
                    body=event_body,
                    conferenceDataVersion=1,
                )
                .execute()
            )

            meet_link = (
                event.get("conferenceData", {})
                .get("entryPoints", [{}])[0]
                .get("uri")
            )

            print("Meet link created:", meet_link)
            return meet_link

        except HttpError as error:
            print(f"Google Calendar error status: {error.resp.status}")
            print(f"Google Calendar error content: {error.content.decode()}")
            return None