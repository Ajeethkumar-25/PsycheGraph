import os
import datetime
import time
import logging

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger("google_calendar")

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
            self.creds = Credentials.from_authorized_user_file(
                TOKEN_PATH,
                SCOPES
            )

        # Refresh token if expired
        if self.creds and self.creds.expired and self.creds.refresh_token:
            try:
                logger.info("Refreshing Google token...")
                self.creds.refresh(Request())
                # Save the refreshed token
                with open(TOKEN_PATH, "w") as token:
                    token.write(self.creds.to_json())
                logger.info("Token refreshed and saved successfully.")
            except Exception as e:
                logger.error(f"Token refresh failed: {e}")
                self.creds = None

        # If no valid credentials → login
        if not self.creds or not self.creds.valid:
            if not os.path.exists(CREDENTIALS_PATH):
                logger.error(f"CRITICAL ERROR: credentials.json not found at {CREDENTIALS_PATH}. Google Calendar will NOT work on this server.")
                return

            flow = InstalledAppFlow.from_client_secrets_file(
                CREDENTIALS_PATH,
                SCOPES
            )

            print("Login required for Google Calendar...")

            # FIX 1 — force refresh token generation
            self.creds = flow.run_local_server(
                port=0,
                access_type="offline",
                prompt="consent"
            )

            # Save token
            with open(TOKEN_PATH, "w") as token:
                token.write(self.creds.to_json())

        # Build service
        try:
            self.service = build(
                "calendar",
                "v3",
                credentials=self.creds,
                cache_discovery=False
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
        Create Google Calendar event with Google Meet link using raw HTTP requests
        to bypass a bug in the google-api-python-client library regarding conferenceDataVersion.
        """
        import requests
        import json

        # Ensure token is valid before starting
        if not self.creds or not self.creds.valid:
            if self.creds and self.creds.expired and self.creds.refresh_token:
                try:
                    logger.info("Refreshing token before event creation...")
                    self.creds.refresh(Request())
                    with open(TOKEN_PATH, "w") as token:
                        token.write(self.creds.to_json())
                except Exception as e:
                    logger.error(f"Failed to refresh token: {e}")
                    return None
            else:
                logger.error("Credentials are not valid or missing completely. Cannot create event.")
                if not os.path.exists(CREDENTIALS_PATH):
                    logger.error(f"Missing {CREDENTIALS_PATH}")
                if not os.path.exists(TOKEN_PATH):
                    logger.error(f"Missing {TOKEN_PATH}")
                return None

        # Ensure UTC timezone
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=datetime.timezone.utc)

        if end_time.tzinfo is None:
            end_time = end_time.replace(tzinfo=datetime.timezone.utc)

        request_id = f"psychegraph-{int(datetime.datetime.utcnow().timestamp())}"

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
                    "requestId": request_id,
                    "conferenceSolutionKey": {
                        "type": "hangoutsMeet"
                    },
                }
            },
        }

        if attendee_email:
            event_body["attendees"] = [{"email": attendee_email}]

        # Create event via POST
        url = "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all"
        headers = {
            "Authorization": f"Bearer {self.creds.token}",
            "Content-Type": "application/json"
        }

        try:
            logger.info("Creating Google event via raw HTTP POST...")
            response = requests.post(url, headers=headers, data=json.dumps(event_body))
            
            if response.status_code != 200:
                logger.error(f"Google Calendar API ERROR: Status {response.status_code}")
                logger.error(f"Response Content: {response.text}")
                return None

            event = response.json()
            logger.info(f"Initial Google event response ID: {event.get('id')}")

            meet_link = None

            # Retry fetch because Meet creation is async
            get_url = f"https://www.googleapis.com/calendar/v3/calendars/primary/events/{event.get('id')}?conferenceDataVersion=1"
            
            for _ in range(3):
                get_resp = requests.get(get_url, headers=headers)
                
                if get_resp.status_code == 200:
                    polled_event = get_resp.json()
                    conference = polled_event.get("conferenceData")

                    if conference:
                        entry_points = conference.get("entryPoints", [])
                        for entry in entry_points:
                            if entry.get("entryPointType") == "video":
                                meet_link = entry.get("uri")

                    if meet_link:
                        break

                time.sleep(1)

            if not meet_link:
                logger.warning("Meet link not generated after polling")
            else:
                logger.info(f"Meet link created successfully: {meet_link}")
            
            return meet_link

        except Exception as e:
            logger.error(f"Unknown calendar error during create_event: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return None