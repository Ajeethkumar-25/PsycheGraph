import asyncio
from sqlalchemy.ext.asyncio import create_async_engine

async def test_remote_db():
    url = "postgresql+asyncpg://psycheuser:password@65.1.249.160:5432/psychedb"
    print(f"Testing connection to: {url}")
    engine = create_async_engine(url)
    try:
        async with engine.connect() as conn:
            print("SUCCESS: Connected to remote DB!")
    except Exception as e:
        print(f"FAIL: {e}")
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(test_remote_db())
