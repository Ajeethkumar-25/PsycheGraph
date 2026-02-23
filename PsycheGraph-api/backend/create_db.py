import asyncio
import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from dotenv import load_dotenv

load_dotenv()

async def create_database():
    # Use 'postgres' database to connect and create the new one
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not found in .env")
        return

    # Extract base connection (to postgres db)
    # Target: postgresql+asyncpg://user:pass@host:port/dbname
    base_url = db_url.rsplit('/', 1)[0] + "/postgres"
    db_name = db_url.rsplit('/', 1)[1]

    engine = create_async_engine(base_url, isolation_level="AUTOCOMMIT")
    
    async with engine.connect() as conn:
        print(f"Checking if database '{db_name}' exists...")
        result = await conn.execute(text(f"SELECT 1 FROM pg_database WHERE datname='{db_name}'"))
        if not result.scalar():
            print(f"Creating database '{db_name}'...")
            await conn.execute(text(f"CREATE DATABASE {db_name}"))
            print("Database created successfully.")
        else:
            print(f"Database '{db_name}' already exists.")
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(create_database())
