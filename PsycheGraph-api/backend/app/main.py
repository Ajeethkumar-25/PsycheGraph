import os
import logging
import sys
import traceback
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from sqlalchemy import text

from .database import engine, Base
from .routers import auth, admin, patients, sessions, appointments, stats

# Load .env from the backend directory explicitly
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_path = os.path.join(base_dir, ".env")
load_dotenv(env_path)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("api")


MIGRATIONS = [
    ("add_org_email",           "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS email VARCHAR;"),
    ("add_org_is_approved",     "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;"),
    ("drop_org_license_not_null","ALTER TABLE organizations ALTER COLUMN license_key DROP NOT NULL;"),
    ("add_avail_org_id",        "ALTER TABLE availabilities ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id);"),
    ("add_avail_created_by",    "ALTER TABLE availabilities ADD COLUMN IF NOT EXISTS created_by_id INTEGER REFERENCES users(id);"),
    ("add_avail_created_at",    "ALTER TABLE availabilities ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE;"),
    ("add_avail_patient_name",  "ALTER TABLE availabilities ADD COLUMN IF NOT EXISTS patient_name VARCHAR;"),
    ("add_avail_doctor_name",   "ALTER TABLE availabilities ADD COLUMN IF NOT EXISTS doctor_name VARCHAR;"),
    ("add_avail_org_name",      "ALTER TABLE availabilities ADD COLUMN IF NOT EXISTS organization_name VARCHAR;"),
    ("add_apt_org_id",          "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id);"),
    ("add_apt_patient_name",    "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_name VARCHAR;"),
    ("add_apt_patient_age",     "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_age INTEGER;"),
    ("add_apt_doctor_name",     "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS doctor_name VARCHAR;"),
    ("add_apt_booked_by_role",  "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS booked_by_role VARCHAR;"),
    ("add_apt_meet_link",       "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS meet_link VARCHAR;"),
    ("drop_users_specialization",        "ALTER TABLE users DROP COLUMN IF EXISTS specialization;"),
    ("drop_doctors_specialization",      "ALTER TABLE doctors DROP COLUMN IF EXISTS specialization;"),
    ("drop_receptionists_specialization","ALTER TABLE receptionists DROP COLUMN IF EXISTS specialization;"),
    ("drop_idx_doctor_specialization",   "DROP INDEX IF EXISTS idx_doctor_specialization;"),
    ("create_doctors_table",
        "CREATE TABLE IF NOT EXISTS doctors ("
        "id SERIAL PRIMARY KEY, "
        "user_id INTEGER UNIQUE NOT NULL REFERENCES users(id), "
        "full_name VARCHAR NOT NULL, "
        "created_by_id INTEGER REFERENCES users(id), "
        "created_at TIMESTAMP WITH TIME ZONE DEFAULT now()"
        ");"),
    ("create_receptionists_table",
        "CREATE TABLE IF NOT EXISTS receptionists ("
        "id SERIAL PRIMARY KEY, "
        "user_id INTEGER UNIQUE NOT NULL REFERENCES users(id), "
        "full_name VARCHAR, "
        "shift_timing VARCHAR, "
        "doctor_ids INTEGER[], "
        "created_at TIMESTAMP WITH TIME ZONE DEFAULT now()"
        ");"),
    # ── remove assemblyai, add fireflies ──────────────────────────────────
    ("drop_session_assemblyai_id",  "ALTER TABLE sessions DROP COLUMN IF EXISTS assemblyai_transcript_id;"),
    ("drop_idx_session_assemblyai", "DROP INDEX IF EXISTS idx_session_assemblyai_id;"),
    # ─────────────────────────────────────────────────────────────────────
    ("add_rec_doctor_ids",        "ALTER TABLE receptionists ADD COLUMN IF NOT EXISTS doctor_ids INTEGER[];"),
    ("drop_receptionist_doctors", "DROP TABLE IF EXISTS receptionist_doctors;"),
    ("idx_org_email",             "CREATE INDEX IF NOT EXISTS idx_org_email ON organizations(email);"),
    ("idx_org_is_approved",       "CREATE INDEX IF NOT EXISTS idx_org_is_approved ON organizations(is_approved);"),
    ("idx_org_is_active",         "CREATE INDEX IF NOT EXISTS idx_org_is_active ON organizations(is_active);"),
    ("idx_patient_created_by",    "CREATE INDEX IF NOT EXISTS idx_patient_created_by ON patients(created_by_id);"),
    ("idx_patient_is_active",     "CREATE INDEX IF NOT EXISTS idx_patient_is_active ON patients(is_active);"),
    ("idx_apt_start_time",        "CREATE INDEX IF NOT EXISTS idx_apt_start_time ON appointments(start_time);"),
    ("idx_apt_availability",      "CREATE INDEX IF NOT EXISTS idx_apt_availability ON appointments(availability_id);"),
    ("idx_apt_created_by",        "CREATE INDEX IF NOT EXISTS idx_apt_created_by ON appointments(created_by_id);"),
    ("idx_apt_doctor_status",     "CREATE INDEX IF NOT EXISTS idx_apt_doctor_status ON appointments(doctor_id, status);"),
    ("idx_apt_org_status",        "CREATE INDEX IF NOT EXISTS idx_apt_org_status ON appointments(organization_id, status);"),
    ("idx_apt_patient_status",    "CREATE INDEX IF NOT EXISTS idx_apt_patient_status ON appointments(patient_id, status);"),
    ("idx_apt_date_status",       "CREATE INDEX IF NOT EXISTS idx_apt_date_status ON appointments(appointment_date, status);"),
    ("idx_avail_org_booked",      "CREATE INDEX IF NOT EXISTS idx_avail_org_booked ON availabilities(organization_id, is_booked);"),
    ("idx_avail_doctor_booked",   "CREATE INDEX IF NOT EXISTS idx_avail_doctor_booked ON availabilities(doctor_id, is_booked);"),
    ("idx_session_date",          "CREATE INDEX IF NOT EXISTS idx_session_date ON sessions(session_date);"),
    ("idx_session_appointment",   "CREATE INDEX IF NOT EXISTS idx_session_appointment ON sessions(appointment_id);"),
    ("idx_session_created_by",    "CREATE INDEX IF NOT EXISTS idx_session_created_by ON sessions(created_by_id);"),
    ("idx_doctor_user_id",        "CREATE INDEX IF NOT EXISTS idx_doctor_user_id ON doctors(user_id);"),
    ("idx_receptionist_user_id",  "CREATE INDEX IF NOT EXISTS idx_receptionist_user_id ON receptionists(user_id);"),
    ("idx_receptionist_doctor_ids_gin",
        "CREATE INDEX IF NOT EXISTS idx_receptionist_doctor_ids ON receptionists USING GIN (doctor_ids);"),
]


async def run_migrations(conn):
    await conn.execute(text(
        "CREATE TABLE IF NOT EXISTS migrations_log ("
        "  migration_id VARCHAR PRIMARY KEY,"
        "  applied_at TIMESTAMP WITH TIME ZONE DEFAULT now()"
        ");"
    ))

    result = await conn.execute(text("SELECT migration_id FROM migrations_log;"))
    applied = {row[0] for row in result.fetchall()}

    pending = [(mid, sql) for mid, sql in MIGRATIONS if mid not in applied]

    if not pending:
        logger.info(f"All {len(MIGRATIONS)} migrations already applied — skipping.")
        return

    logger.info(f"Applying {len(pending)} pending migration(s)...")

    succeeded = []
    for migration_id, sql in pending:
        await conn.execute(text(f"SAVEPOINT mig_{migration_id};"))
        try:
            await conn.execute(text(sql))
            await conn.execute(text(f"RELEASE SAVEPOINT mig_{migration_id};"))
            succeeded.append(migration_id)
            logger.info(f"  ✓ {migration_id}")
        except Exception as e:
            await conn.execute(text(f"ROLLBACK TO SAVEPOINT mig_{migration_id};"))
            logger.warning(f"  ✗ {migration_id} skipped: {e}")

    if succeeded:
        placeholders = ", ".join(f"(:id_{i})" for i in range(len(succeeded)))
        params = {f"id_{i}": mid for i, mid in enumerate(succeeded)}
        await conn.execute(
            text(f"INSERT INTO migrations_log (migration_id) VALUES {placeholders} ON CONFLICT DO NOTHING;"),
            params
        )
        logger.info(f"Migrations complete: {len(succeeded)} applied.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await run_migrations(conn)

    logger.info("Database ready.")
    yield

    await engine.dispose()


app = FastAPI(lifespan=lifespan, title="PsycheGraph API")


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    logger.info(f"Incoming Request: {request.method} {request.url}")
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        logger.info(f"Response: {response.status_code} - Duration: {process_time:.4f}s")
        return response
    except Exception as exc:
        process_time = time.time() - start_time
        logger.error(f"Request failed: {request.method} {request.url} - Duration: {process_time:.4f}s")
        logger.error(f"Error: {str(exc)}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"message": "Internal Server Error", "details": str(exc)},
        )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled Exception: {str(exc)}")
    logger.error(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"message": "Internal Server Error", "details": str(exc)},
    )


origins = [
    "http://localhost:5173",
    "http://localhost:8000",
    "http://52.66.143.164",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(admin.hospital_router)
app.include_router(admin.doctor_router)
app.include_router(admin.receptionist_router)
app.include_router(patients.router)
app.include_router(sessions.router)
app.include_router(appointments.router)
app.include_router(stats.router)


@app.get("/")
def read_root():
    logger.info("Root endpoint called")
    return {"Hello": "World", "Service": "PsycheGraph Backend", "Docs": "/docs"}