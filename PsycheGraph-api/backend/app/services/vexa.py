import os
import logging
import requests
from pathlib import Path
from dotenv import load_dotenv

logger = logging.getLogger("vexa")

_base_dir = Path(__file__).resolve().parent.parent.parent
load_dotenv(_base_dir / ".env")

VEXA_API_KEY = os.getenv("VEXA_API_KEY", "")
VEXA_BASE_URL = "https://api.cloud.vexa.ai"


def _headers():
    return {
        "X-API-Key": VEXA_API_KEY,
        "Content-Type": "application/json"
    }


def extract_meeting_code(meet_link: str) -> str | None:
    """
    Extracts the meeting code from a Google Meet link.
    e.g. https://meet.google.com/abc-defg-hij -> abc-defg-hij
    """
    if not meet_link:
        return None
    parts = meet_link.rstrip("/").split("/")
    code = parts[-1]
    # Basic validation: should look like xxx-xxxx-xxx
    if len(code) > 5 and "-" in code:
        return code
    return None


def send_bot_to_meeting(meet_link: str, bot_name: str = "PsycheGraph Bot") -> bool:
    """
    Sends Vexa bot to a Google Meet using vexa-client.
    Returns True if successful, False otherwise.
    """
    if not VEXA_API_KEY:
        logger.error("[VEXA] VEXA_API_KEY not set in .env")
        return False

    meeting_code = extract_meeting_code(meet_link)
    if not meeting_code:
        logger.error(f"[VEXA] Could not extract meeting code from: {meet_link}")
        return False

    try:
        from vexa import VexaAPI
        client = VexaAPI(token=VEXA_API_KEY)
        client.request_bot(
            platform="google_meet",
            native_meeting_id=meeting_code,
            bot_name=bot_name
        )
        logger.info(f"[VEXA] Bot sent to meeting: {meeting_code}")
        return True

    except Exception as e:
        logger.error(f"[VEXA] Error sending bot to meeting {meeting_code}: {e}")
        return False


def set_webhook_url(webhook_url: str) -> bool:
    """
    Registers the webhook URL with Vexa using the vexa-client library.
    Call this once after deployment.
    """
    if not VEXA_API_KEY:
        logger.error("[VEXA] VEXA_API_KEY not set in .env")
        return False

    try:
        from vexa import VexaAPI
        client = VexaAPI(token=VEXA_API_KEY)
        client.set_webhook_url(webhook_url)
        logger.info(f"[VEXA] Webhook registered: {webhook_url}")
        return True
    except Exception as e:
        logger.error(f"[VEXA] Error registering webhook: {e}")
        return False


def get_transcript(meeting_code: str) -> dict | None:
    """
    Fetches full transcript from Vexa after meeting ends using vexa-client.
    Returns dict with transcript text and segments, or None if failed.
    """
    if not VEXA_API_KEY:
        logger.error("[VEXA] VEXA_API_KEY not set in .env")
        return None

    try:
        from vexa import VexaAPI
        client = VexaAPI(token=VEXA_API_KEY)
        transcript = client.get_transcript(
            platform="google_meet",
            native_meeting_id=meeting_code
        )

        if not transcript:
            logger.warning(f"[VEXA] No transcript found for {meeting_code}")
            return None

        # transcript is a list of {speaker, text} dicts
        segments = transcript if isinstance(transcript, list) else []
        lines = []
        for seg in segments:
            speaker = seg.get("speaker") or seg.get("speaker_name") or "Unknown"
            text = (seg.get("text") or "").strip()
            if text:
                lines.append(f"[{speaker}]: {text}")

        transcript_text = "\n".join(lines)
        logger.info(f"[VEXA] Transcript fetched for {meeting_code} — {len(segments)} segments")

        return {
            "transcript": transcript_text,
            "segments": segments,
        }

    except Exception as e:
        logger.error(f"[VEXA] Error fetching transcript for {meeting_code}: {e}")
        return None