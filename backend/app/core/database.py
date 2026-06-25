from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import get_settings

settings = get_settings()


class Database:
    client: AsyncIOMotorClient = None
    db = None


database = Database()


async def connect_to_mongo():
    database.client = AsyncIOMotorClient(settings.MONGODB_URL)
    database.db = database.client[settings.DATABASE_NAME]

    # Create indexes
    await database.db.users.create_index("phone", unique=True)
    await database.db.orders.create_index("user_id")
    await database.db.orders.create_index("status")
    await database.db.addresses.create_index("user_id")
    await database.db.services.create_index("slug", unique=True)

    print(f"✅ Connected to MongoDB: {settings.DATABASE_NAME}")


async def close_mongo_connection():
    if database.client:
        database.client.close()
        print("❌ MongoDB connection closed")


def get_db():
    return database.db
