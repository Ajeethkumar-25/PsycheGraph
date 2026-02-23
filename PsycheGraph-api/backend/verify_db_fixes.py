import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from datetime import datetime, timezone
from dotenv import load_dotenv
import sys

# Add the app directory to sys.path
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "app"))

from app import models, database

async def verify_fixes():
    # Load .env
    load_dotenv(".env")
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not found")
        return

    engine = create_async_engine(db_url)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with AsyncSessionLocal() as db:
        try:
            # 1. Check if we can reach the DB
            print("Checking database connection...")
            await db.execute(select(1))
            print("Connection OK.")

            # 2. Test Patient creation (simulated)
            print("Testing Patient creation...")
            # We need an org and doctor for this. Let's find existing ones.
            org_res = await db.execute(select(models.Organization).limit(1))
            org = org_res.scalars().first()
            doc_res = await db.execute(select(models.Doctor).limit(1))
            doc = doc_res.scalars().first()

            if not org or not doc:
                print("Skipping detailed tests: No organization or doctor found in DB. Please run init_data.py first.")
                return

            new_patient = models.Patient(
                full_name="Test Patient Fix",
                organization_id=org.id,
                doctor_id=doc.id,
                email="test_fix@example.com",
                date_of_birth=datetime(1990, 1, 1)
            )
            db.add(new_patient)
            await db.commit()
            await db.refresh(new_patient)
            print(f"Patient created with ID: {new_patient.id}")

            # 3. Test Session creation (The core fix)
            print("Testing Session creation...")
            new_session = models.Session(
                patient_id=new_patient.id,
                doctor_id=doc.id,
                session_date=datetime.now(timezone.utc),
                transcript="Test transcript",
                summary="Test summary",
                soap_notes="Test SOAP"
            )
            db.add(new_session)
            await db.commit()
            await db.refresh(new_session)
            print(f"Session created with ID: {new_session.id}")
            
            # Verify property date works
            print(f"Verifying session date property: {new_session.date}")

            # Cleanup
            print("Cleaning up test data...")
            await db.delete(new_session)
            await db.delete(new_patient)
            await db.commit()
            print("Cleanup done.")
            print("\nVERIFICATION SUCCESSFUL!")

        except Exception as e:
            print(f"VERIFICATION FAILED: {e}")
            await db.rollback()
        finally:
            await engine.dispose()

if __name__ == "__main__":
    asyncio.run(verify_fixes())
