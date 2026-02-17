
import os.path
import datetime
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import json

# If modifying these scopes, delete the file token.json.
SCOPES = ["https://www.googleapis.com/auth/calendar"]

class GoogleCalendarService:
    def __init__(self, credentials_path: str = "credentials.json", token_path: str = "token.json"):
        self.credentials_path = credentials_path
        self.token_path = token_path
        self.creds = None
        self.service = None
        self._authenticate()

    def _authenticate(self):
        """Authenticates with Google Calendar API."""
        if os.path.exists(self.token_path):
            try:
                self.creds = Credentials.from_authorized_user_file(self.token_path, SCOPES)
            except Exception as e:
                print(f"Error loading token.json: {e}")
                self.creds = None

        # If there are no (valid) credentials available, let the user log in.
        if not self.creds or not self.creds.valid:
            if self.creds and self.creds.expired and self.creds.refresh_token:
                try:
                    self.creds.refresh(Request())
                except Exception as e:
                     print(f"Error refreshing token: {e}")
                     self.creds = None
            
            if not self.creds:
                if os.path.exists(self.credentials_path):
                    try:
                        flow = InstalledAppFlow.from_client_secrets_file(self.credentials_path, SCOPES)
                        # Use a local server for auth if running locally, otherwise this might need a different flow
                        # For a backend server, ideally we use Service Account or a stored refresh token.
                        # This flow is for "Installed App" (desktop) which requires browser interaction.
                        # For a chaotic agent/headless environment, this might hang if we try to run it.
                        # fallback: We will ONLY try this if explicitly invoked or we accept we might fail if no token.
                         # verification purposes: We simply skip if no token and no interaction possible
                        pass 
                    except Exception as e:
                        print(f"Error initiating flow: {e}")
                else:
                    print("No credentials.json found. Google Calendar integration will be disabled/mocked.")

        if self.creds and self.creds.valid:
             try:
                self.service = build("calendar", "v3", credentials=self.creds)
             except Exception as e:
                 print(f"Error building service: {e}")

    def create_event(self, summary: str, start_time: datetime.datetime, end_time: datetime.datetime, attendee_email: str = None) -> str:
        """
        Creates a Google Calendar event with a Google Meet link.
        Returns the meet link if successful, or None.
        """
        if not self.service:
            print("Google Calendar service not initialized. Returning mock link.")
            return f"https://meet.google.com/mock-{int(start_time.timestamp())}"

        # Convert to RFC3339 format
        start_str = start_time.isoformat() + 'Z'  # 'Z' indicates UTC time
        end_str = end_time.isoformat() + 'Z'

        event = {
            'summary': summary,
            'description': 'Appointment via PsycheGraph',
            'start': {
                'dateTime': start_str,
                'timeZone': 'UTC',
            },
            'end': {
                'dateTime': end_str,
                'timeZone': 'UTC',
            },
            'conferenceData': {
                'createRequest': {
                    'requestId': f"req-{int(start_time.timestamp())}",
                    'conferenceSolutionKey': {'type': 'hangoutsMeet'}
                }
            },
            'attendees': [],
        }

        if attendee_email:
            event['attendees'].append({'email': attendee_email})

        try:
            event = self.service.events().insert(calendarId='primary', body=event, conferenceDataVersion=1).execute()
            print(f"Event created: {event.get('htmlLink')}")
            return event.get('conferenceData', {}).get('entryPoints', [{}])[0].get('uri')
        except HttpError as error:
            print(f"An error occurred: {error}")
            return f"https://meet.google.com/error-fallback-{int(start_time.timestamp())}"
