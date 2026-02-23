import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

async def dump_details():
    load_dotenv("backend/.env")
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        db_url = "postgresql+asyncpg://user:password@localhost/psychegraph"

    engine = create_async_engine(db_url)
    async with engine.connect() as conn:
        print("--- Doctors ---")
        result = await conn.execute(text("SELECT id, user_id, full_name, license_key FROM doctors"))
        for row in result:
            print(f"ID: {row[0]}, UserID: {row[1]}, Name: {row[2]}, License: {row[3]}")
            
        print("\n--- Patients (Full) ---")
        result = await conn.execute(text("SELECT id, full_name, organization_id, doctor_id, created_by_id FROM patients"))
        for row in result:
            print(f"ID: {row[0]}, Name: {row[1]}, OrgID: {row[2]}, DocID: {row[3]}, CreatedByID: {row[4]}")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(dump_details())
