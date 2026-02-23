import asyncio
from sqlalchemy.ext.asyncio import create_async_engine

async def test_creds():
    passwords = ['', 'password', 'postgres', 'Admin@123', 'Bavi@2121', 'Bavi%402121']
    users = ['postgres', 'user']
    databases = ['postgres', 'psychegraph']
    ports = [5432]
    
    print(f"Starting test on {len(passwords)*len(users)*len(databases)*len(ports)} combinations...")
    for port in ports:
        for db_name in databases:
            for user in users:
                for p in passwords:
                    url = f"postgresql+asyncpg://{user}{':' + p if p else ''}@localhost:{port}/{db_name}"
                    try:
                        engine = create_async_engine(url, connect_args={"command_timeout": 2})
                        async with engine.connect() as conn:
                            print(f"!!! SUCCESS: {url}")
                            return
                    except Exception as e:
                        pass
    print("All combinations failed.")

if __name__ == "__main__":
    asyncio.run(test_creds())
