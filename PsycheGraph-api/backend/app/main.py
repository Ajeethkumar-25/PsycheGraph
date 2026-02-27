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


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:

        # Create all tables from models (safe with IF NOT EXISTS)
        await conn.run_sync(Base.metadata.create_all)

        # ── Column migrations (safe, all IF NOT EXISTS) ────────────────
        await conn.execute(text("ALTER TABLE organizations ADD COLUMN IF NOT EXISTS email VARCHAR;"))
        await conn.execute(text("ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;"))
        await conn.execute(text("ALTER TABLE organizations ALTER COLUMN license_key DROP NOT NULL;"))
        await conn.execute(text("ALTER TABLE availabilities ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id);"))
        await conn.execute(text("ALTER TABLE availabilities ADD COLUMN IF NOT EXISTS created_by_id INTEGER REFERENCES users(id);"))
        await conn.execute(text("ALTER TABLE availabilities ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE;"))
        await conn.execute(text("ALTER TABLE availabilities ADD COLUMN IF NOT EXISTS patient_name VARCHAR;"))
        await conn.execute(text("ALTER TABLE availabilities ADD COLUMN IF NOT EXISTS doctor_name VARCHAR;"))
        await conn.execute(text("ALTER TABLE availabilities ADD COLUMN IF NOT EXISTS organization_name VARCHAR;"))
        await conn.execute(text("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id);"))
        await conn.execute(text("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_name VARCHAR;"))
        await conn.execute(text("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_age INTEGER;"))
        await conn.execute(text("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS doctor_name VARCHAR;"))
        await conn.execute(text("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS booked_by_role VARCHAR;"))
        await conn.execute(text("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS meet_link VARCHAR;"))

        # ── New tables (doctors + receptionists with doctor_ids array) ─
        await conn.execute(text(
            "CREATE TABLE IF NOT EXISTS doctors ("
            "id SERIAL PRIMARY KEY, "
            "user_id INTEGER UNIQUE NOT NULL REFERENCES users(id), "
            "full_name VARCHAR NOT NULL, "
            "specialization VARCHAR NOT NULL, "
            "created_by_id INTEGER REFERENCES users(id), "
            "created_at TIMESTAMP WITH TIME ZONE DEFAULT now()"
            ");"
        ))
        await conn.execute(text(
            "CREATE TABLE IF NOT EXISTS receptionists ("
            "id SERIAL PRIMARY KEY, "
            "user_id INTEGER UNIQUE NOT NULL REFERENCES users(id), "
            "full_name VARCHAR, "
            "specialization VARCHAR, "
            "shift_timing VARCHAR, "
            "doctor_ids INTEGER[], "
            "created_at TIMESTAMP WITH TIME ZONE DEFAULT now()"
            ");"
        ))
        # doctor_ids column may be missing if receptionists table already existed without it
        await conn.execute(text("ALTER TABLE receptionists ADD COLUMN IF NOT EXISTS doctor_ids INTEGER[];"))

        # ── Drop the old join table if it was created in a previous run ─
        await conn.execute(text("DROP TABLE IF EXISTS receptionist_doctors;"))

        # ── Indexes ────────────────────────────────────────────────────
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_org_email ON organizations(email);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_org_is_approved ON organizations(is_approved);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_org_is_active ON organizations(is_active);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_patient_created_by ON patients(created_by_id);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_patient_is_active ON patients(is_active);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_apt_start_time ON appointments(start_time);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_apt_availability ON appointments(availability_id);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_apt_created_by ON appointments(created_by_id);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_apt_doctor_status ON appointments(doctor_id, status);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_apt_org_status ON appointments(organization_id, status);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_apt_patient_status ON appointments(patient_id, status);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_apt_date_status ON appointments(appointment_date, status);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_avail_org_booked ON availabilities(organization_id, is_booked);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_avail_doctor_booked ON availabilities(doctor_id, is_booked);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_session_date ON sessions(session_date);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_session_appointment ON sessions(appointment_id);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_session_created_by ON sessions(created_by_id);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_doctor_user_id ON doctors(user_id);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_doctor_specialization ON doctors(specialization);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_receptionist_user_id ON receptionists(user_id);"))

    logger.info("Database tables, migrations, and indexes verified.")
    yield

    # Shutdown
    await engine.dispose()


app = FastAPI(lifespan=lifespan, title="PsycheGraph API")


# ── Request logging middleware ─────────────────────────────────────────────

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


# ── CORS ───────────────────────────────────────────────────────────────────

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


# ── Routers ────────────────────────────────────────────────────────────────

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