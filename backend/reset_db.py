import asyncio
from app.database import engine
from app.models import Base

async def reset_db():
    async with engine.begin() as conn:
        print("Dropping all tables...")
        await conn.run_sync(Base.metadata.drop_all)
        print("All tables dropped.")
        print("Recreating tables...")
        await conn.run_sync(Base.metadata.create_all)
        print("Tables recreated.")

if __name__ == "__main__":
    asyncio.run(reset_db())
