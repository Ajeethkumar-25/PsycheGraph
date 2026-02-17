import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from sqlalchemy import text

from .database import engine, Base
from .routers import auth, admin, patients, sessions, appointments, stats

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create tables and ensure columns exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
        # Ensure new columns exist (Migration logic)
        await conn.execute(text("ALTER TABLE availabilities ADD COLUMN IF NOT EXISTS created_by_id INTEGER REFERENCES users(id);"))
        await conn.execute(text("ALTER TABLE availabilities ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE;"))
        await conn.execute(text("ALTER TABLE availabilities ADD COLUMN IF NOT EXISTS patient_name VARCHAR;"))
        await conn.execute(text("ALTER TABLE availabilities ADD COLUMN IF NOT EXISTS doctor_name VARCHAR;"))
        await conn.execute(text("ALTER TABLE availabilities ADD COLUMN IF NOT EXISTS organization_name VARCHAR;"))
        await conn.execute(text("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_name VARCHAR;"))
        
    logger.info("Database tables and columns verified.")
    yield
    # Shutdown
    await engine.dispose()

app = FastAPI(lifespan=lifespan, title="PsycheGraph API")

# Logging Configuration
import sys
import traceback
import time

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("api")

# Middleware for Logging
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    
    # Log Request
    logger.info(f"Incoming Request: {request.method} {request.url}")
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        logger.info(f"Response: {response.status_code} - Duration: {process_time:.4f}s")
        return response
    except Exception as exc:
        process_time = time.time() - start_time
        logger.error(f"Request failed: {request.method} {request.url} - Duration: {process_time:.4f}s")
        logger.error(f"Error details: {str(exc)}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"message": "Internal Server Error", "details": str(exc)},
        )

from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled Exception: {str(exc)}")
    logger.error(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"message": "Internal Server Error", "details": str(exc)},
    )

# CORS
origins = [
    "http://localhost:5173",
    "http://localhost:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
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