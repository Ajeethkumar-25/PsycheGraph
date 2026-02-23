import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

async def check_db_state():
    # Load .env
    load_dotenv("backend/.env")
    db_url = os.getenv("DATABASE_URL")
    print(f"Checking DATABASE_URL from .env: {db_url}")
    
    if not db_url:
        db_url = "postgresql+asyncpg://user:password@localhost/psychegraph"
        print(f"Using default fallback: {db_url}")

    engine = create_async_engine(db_url)
    async with engine.connect() as conn:
        tables = ['organizations', 'users', 'doctors', 'receptionists', 'patients', 'sessions', 'availabilities', 'appointments']
        for table in tables:
            try:
                result = await conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
                count = result.scalar()
                print(f"Table {table:15}: {count} rows")
            except Exception as e:
                print(f"Table {table:15}: Error {e}")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(check_db_state())
