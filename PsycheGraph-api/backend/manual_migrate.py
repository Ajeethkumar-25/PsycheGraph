import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

async def migrate():
    load_dotenv(".env")
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not found")
        return

    engine = create_async_engine(db_url)
    async with engine.begin() as conn:
        print("Adding missing columns to appointments table...")
        try:
            await conn.execute(text("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS doctor_name VARCHAR;"))
            await conn.execute(text("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_name VARCHAR;"))
            await conn.execute(text("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS organization_id INTEGER;"))
            print("Successfully updated appointments table.")
        except Exception as e:
            print(f"Error updating appointments: {e}")
            
        print("Checking availabilities columns...")
        try:
            await conn.execute(text("ALTER TABLE availabilities ADD COLUMN IF NOT EXISTS organization_id INTEGER;"))
            await conn.execute(text("ALTER TABLE availabilities ADD COLUMN IF NOT EXISTS doctor_name VARCHAR;"))
            await conn.execute(text("ALTER TABLE availabilities ADD COLUMN IF NOT EXISTS patient_name VARCHAR;"))
            await conn.execute(text("ALTER TABLE availabilities ADD COLUMN IF NOT EXISTS organization_name VARCHAR;"))
            print("All requested columns checked/added.")
        except Exception as e:
            print(f"Error during migration: {e}")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(migrate())
