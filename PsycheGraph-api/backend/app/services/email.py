import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent.parent / ".env")

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
FROM_EMAIL = os.getenv("FROM_EMAIL", SMTP_USER)

# FIX: Use logger instead of print() for config values.
# print() on module import runs at server startup for every worker process,
# and exposes credentials in stdout logs. Use DEBUG level so they only
# appear when explicitly enabled.
logger = logging.getLogger("email-service")
logger.debug(f"[EMAIL CONFIG] SMTP_HOST={SMTP_HOST}")
logger.debug(f"[EMAIL CONFIG] SMTP_PORT={SMTP_PORT}")
logger.debug(f"[EMAIL CONFIG] SMTP_USER={SMTP_USER}")
logger.debug(f"[EMAIL CONFIG] SMTP_PASSWORD={'SET' if SMTP_PASSWORD else 'NOT SET'}")
logger.debug(f"[EMAIL CONFIG] FROM_EMAIL={FROM_EMAIL}")


def _send(to_email: str, subject: str, body: str):
    """Internal helper — sends an email. Never raises, always logs."""
    if not SMTP_USER or not SMTP_PASSWORD:
        logger.info(f"[EMAIL SKIP] No SMTP config. Would send to {to_email}: {subject}")
        return

    msg = MIMEMultipart()
    msg["From"] = FROM_EMAIL
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(FROM_EMAIL, to_email, msg.as_string())
        logger.info(f"[EMAIL SENT] To={to_email} Subject={subject}")
    except Exception as e:
        logger.error(f"[EMAIL ERROR] Failed to send to {to_email}: {e}")


def send_license_key_email(to_email: str, org_name: str, license_key: str):
    """Sent to organization email when org is registered."""
    subject = f"PsycheGraph — Your License Key for {org_name}"
    body = f"""
Dear {org_name} Team,

Your organization has been approved on PsycheGraph!

Your License Key is:

    {license_key}

Use this key when Hospital Admins log in to join your organization.
Please keep this key secure and do not share it publicly.

Regards,
PsycheGraph Team
"""
    _send(to_email, subject, body)


def send_appointment_email(
    to_email: str,
    patient_name: str,
    doctor_name: str,
    doctor_id: int,
    role: str,
    appointment_date: str,
    start_time: str,
    end_time: str,
    meet_link: str
):
    """
    Booking confirmation — sent when appointment is created.
    Meet link is NOT included here; it will be sent separately 30 minutes before.
    """
    subject = "PsycheGraph — Appointment Confirmation"
    body = f"""
Dear {patient_name},

Your appointment has been successfully booked on PsycheGraph!

Appointment Details:
─────────────────────────────
Doctor Name   : Dr. {doctor_name}
Booked By     : {role}
Date          : {appointment_date}
Start Time    : {start_time}
End Time      : {end_time}
─────────────────────────────

You will receive the Google Meet link 30 minutes before your appointment.

Regards,
PsycheGraph Team
"""
    _send(to_email, subject, body)


def send_meet_link_email(
    to_email: str,
    recipient_name: str,
    doctor_name: str,
    appointment_date: str,
    start_time: str,
    end_time: str,
    meet_link: str
):
    """
    Meet link reminder — sent to BOTH patient and doctor
    exactly 30 minutes before the appointment starts.
    """
    subject = "PsycheGraph — Your Appointment Starts in 30 Minutes"
    body = f"""
Dear {recipient_name},

Your appointment with Dr. {doctor_name} is starting in 30 minutes!

Appointment Details:
─────────────────────────────
Doctor Name   : Dr. {doctor_name}
Date          : {appointment_date}
Start Time    : {start_time}
End Time      : {end_time}
─────────────────────────────

Join your Google Meet session here:
{meet_link}

Please join the meeting on time.

Regards,
PsycheGraph Team
"""
    _send(to_email, subject, body)