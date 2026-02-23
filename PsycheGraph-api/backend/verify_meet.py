import asyncio
import datetime
from app.services.google_calendar import GoogleCalendarService
import os

async def verify_meet():
    # Robust path resolution
    base_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(base_dir)
    
    # Try multiple locations for credentials
    potential_creds = [
        os.path.join(base_dir, "credentials.json"),
        os.path.join(root_dir, "credentials.json"),
        os.path.join(root_dir, "credential.json")
    ]
    
    creds_path = next((p for p in potential_creds if os.path.exists(p)), potential_creds[0])
    token_path = os.path.join(base_dir, "token.json")

    service = GoogleCalendarService(
        credentials_path=creds_path,
        token_path=token_path
    )
    
    start_time = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=1)
    end_time = start_time + datetime.timedelta(minutes=30)
    
    print("Attempting to create a test event with Google Meet...")
    meet_link = service.create_event(
        summary="Test Integration Appointment",
        start_time=start_time,
        end_time=end_time
    )
    
    if meet_link and "mock" not in meet_link:
        print(f"SUCCESS! Real Google Meet link generated: {meet_link}")
    else:
        print(f"FAILED or MOCKED. Result: {meet_link}")

if __name__ == "__main__":
    asyncio.run(verify_meet())
