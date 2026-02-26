import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent.parent / ".env")

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER")       # your Gmail address
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")  # your Gmail app password
FROM_EMAIL = os.getenv("FROM_EMAIL", SMTP_USER)

print(f"[EMAIL CONFIG] SMTP_HOST={SMTP_HOST}")
print(f"[EMAIL CONFIG] SMTP_PORT={SMTP_PORT}")
print(f"[EMAIL CONFIG] SMTP_USER={SMTP_USER}")
print(f"[EMAIL CONFIG] SMTP_PASSWORD={'SET' if SMTP_PASSWORD else 'NOT SET'}")
print(f"[EMAIL CONFIG] FROM_EMAIL={FROM_EMAIL}")


def send_license_key_email(to_email: str, org_name: str, license_key: str):
    if not SMTP_USER or not SMTP_PASSWORD:
        print(f"[EMAIL SKIP] No SMTP config. License key for {org_name}: {license_key}")
        return

    subject = f"PsycheGraph — Your License Key for {org_name}"
    body = f"""
Dear {org_name} Team,

Your organization has been approved on PsycheGraph!

Your License Key is:

    {license_key}

Use this key to register doctors and receptionists under your organization.

Please keep this key secure and do not share it publicly.

Regards,
PsycheGraph Team
"""

    msg = MIMEMultipart()
    msg["From"] = FROM_EMAIL
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(FROM_EMAIL, to_email, msg.as_string())
        print(f"[EMAIL SENT] License key sent to {to_email}")
    except Exception as e:
        print(f"[WARNING] Email sending failed: {e}")


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
    if not SMTP_USER or not SMTP_PASSWORD:
        print(f"[EMAIL SKIP] No SMTP config. Appointment confirmation for {patient_name}")
        return

    subject = f"PsycheGraph — Appointment Confirmation"
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
Google Meet   : {meet_link if meet_link else "Will be shared shortly"}
─────────────────────────────

Please join the meeting on time using the link above.

Regards,
PsycheGraph Team
"""

    msg = MIMEMultipart()
    msg["From"] = FROM_EMAIL
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(FROM_EMAIL, to_email, msg.as_string())
        print(f"[EMAIL SENT] Appointment confirmation sent to {to_email}")
    except Exception as e:
        print(f"[EMAIL ERROR] Failed to send appointment email: {e}")
        raise