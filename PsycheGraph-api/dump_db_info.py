import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

async def dump_data():
    load_dotenv("backend/.env")
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        db_url = "postgresql+asyncpg://user:password@localhost/psychegraph"

    engine = create_async_engine(db_url)
    async with engine.connect() as conn:
        print("--- Organizations ---")
        result = await conn.execute(text("SELECT id, name, license_key FROM organizations"))
        for row in result:
            print(f"ID: {row[0]}, Name: {row[1]}, License: {row[2]}")
            
        print("\n--- Users ---")
        result = await conn.execute(text("SELECT id, email, role, organization_id FROM users"))
        for row in result:
            print(f"ID: {row[0]}, Email: {row[1]}, Role: {row[2]}, OrgID: {row[3]}")

        print("\n--- Patients ---")
        result = await conn.execute(text("SELECT id, full_name, organization_id, doctor_id FROM patients"))
        for row in result:
            print(f"ID: {row[0]}, Name: {row[1]}, OrgID: {row[2]}, DocID: {row[3]}")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(dump_data())
